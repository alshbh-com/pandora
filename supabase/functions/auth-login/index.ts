import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

function codeToEmail(code: string): string {
  return code.replace(/@/g, '_at_').replace(/[^a-zA-Z0-9._-]/g, '_') + '@thepilito.ship'
}



Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { password, action, userData } = await req.json()

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Helper: verify caller is owner or admin
    const verifyCaller = async () => {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) return null
      const callerClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } }, auth: { autoRefreshToken: false, persistSession: false } }
      )
      const { data: { user: caller } } = await callerClient.auth.getUser()
      if (!caller) return null
      const { data: callerRoles } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', caller.id)
      const isOwnerOrAdmin = callerRoles?.some(r => r.role === 'owner' || r.role === 'admin')
      return isOwnerOrAdmin ? caller : null
    }

    // Helper: check if user is owner
    const isUserOwner = async (userId: string): Promise<boolean> => {
      const { data } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', userId).eq('role', 'owner')
      return (data && data.length > 0) || false
    }

    // ---- CREATE FIRST OWNER (no auth required, only if no owners exist) ----
    if (action === 'create-first-owner') {
      const { data: existingOwners } = await supabaseAdmin.from('user_roles').select('id').eq('role', 'owner').limit(1)
      if (existingOwners && existingOwners.length > 0) {
        return new Response(JSON.stringify({ error: 'يوجد مالك بالفعل' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const ownerPassword = password
      const email = codeToEmail(ownerPassword)
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email, password: ownerPassword, email_confirm: true,
        user_metadata: { full_name: 'المالك' }
      })
      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      await supabaseAdmin.from('profiles').update({ full_name: 'المالك', login_code: ownerPassword }).eq('id', newUser.user.id)
      await supabaseAdmin.from('user_roles').insert({ user_id: newUser.user.id, role: 'owner' })

      return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ---- CREATE USER ----
    if (action === 'create-user') {
      const caller = await verifyCaller()
      if (!caller) {
        return new Response(JSON.stringify({ error: 'غير مصرح - يجب تسجيل الدخول كمالك أو مسؤول' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const { full_name, phone, login_code, role, office_id } = userData
      if (!role || !['owner', 'admin', 'courier', 'office'].includes(role)) {
        return new Response(JSON.stringify({ error: 'يجب اختيار الصلاحية (مالك أو مسؤول أو مندوب أو مكتب)' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      if (role === 'office' && !office_id) {
        return new Response(JSON.stringify({ error: 'يجب اختيار المكتب' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const email = codeToEmail(login_code)

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: login_code,
        email_confirm: true,
        user_metadata: { full_name }
      })

      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const profileUpdate: any = { full_name, phone: phone || '', login_code }
      if (role === 'office' && office_id) {
        profileUpdate.office_id = office_id
      }

      await supabaseAdmin.from('profiles').update(profileUpdate).eq('id', newUser.user.id)
      await supabaseAdmin.from('user_roles').insert({ user_id: newUser.user.id, role })

      return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ---- UPDATE PASSWORD ----
    if (action === 'update-password') {
      const caller = await verifyCaller()
      if (!caller) {
        return new Response(JSON.stringify({ error: 'غير مصرح' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const { user_id, new_password } = userData
      const newEmail = codeToEmail(new_password)

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
        password: new_password,
        email: newEmail,
        email_confirm: true,
      })

      if (!updateError) {
        await supabaseAdmin.from('profiles').update({ login_code: new_password }).eq('id', user_id)
      }

      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Return the user's current role to confirm it's preserved
      const { data: roles } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', user_id)

      return new Response(JSON.stringify({ success: true, roles: roles?.map(r => r.role) || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ---- DELETE USER ----
    if (action === 'delete-user') {
      const caller = await verifyCaller()
      if (!caller) {
        return new Response(JSON.stringify({ error: 'غير مصرح' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const { user_id } = userData
      
      await supabaseAdmin.from('user_roles').delete().eq('user_id', user_id)
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id)

      if (deleteError) {
        return new Response(JSON.stringify({ error: deleteError.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ---- LOGIN ----
    if (!password) {
      return new Response(JSON.stringify({ error: 'كلمة المرور مطلوبة' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }


    const email = codeToEmail(password)
    let { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password })

    if (error) {
      return new Response(JSON.stringify({ error: 'كلمة المرور غير صحيحة' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: roles } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', data.user!.id)

    return new Response(JSON.stringify({ 
      session: data.session, user: data.user, roles: roles?.map(r => r.role) || []
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
