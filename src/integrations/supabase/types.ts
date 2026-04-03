export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      advances: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          reason: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string | null
          type?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      cash_flow_entries: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          entry_date: string
          id: string
          notes: string | null
          office_id: string | null
          reason: string | null
          type: string
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          entry_date?: string
          id?: string
          notes?: string | null
          office_id?: string | null
          reason?: string | null
          type?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          entry_date?: string
          id?: string
          notes?: string | null
          office_id?: string | null
          reason?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_flow_entries_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          agreement_price: number | null
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          agreement_price?: number | null
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          agreement_price?: number | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      company_payments: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
        }
        Insert: {
          amount?: number
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_bonuses: {
        Row: {
          amount: number
          courier_id: string
          created_at: string
          created_by: string | null
          id: string
          reason: string | null
        }
        Insert: {
          amount?: number
          courier_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string | null
        }
        Update: {
          amount?: number
          courier_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string | null
        }
        Relationships: []
      }
      courier_collections: {
        Row: {
          amount: number
          collected_by: string | null
          courier_id: string
          created_at: string
          id: string
          order_id: string | null
        }
        Insert: {
          amount?: number
          collected_by?: string | null
          courier_id: string
          created_at?: string
          id?: string
          order_id?: string | null
        }
        Update: {
          amount?: number
          collected_by?: string | null
          courier_id?: string
          created_at?: string
          id?: string
          order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courier_collections_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_locations: {
        Row: {
          courier_id: string
          id: string
          latitude: number
          longitude: number
          updated_at: string
        }
        Insert: {
          courier_id: string
          id?: string
          latitude: number
          longitude: number
          updated_at?: string
        }
        Update: {
          courier_id?: string
          id?: string
          latitude?: number
          longitude?: number
          updated_at?: string
        }
        Relationships: []
      }
      delivery_prices: {
        Row: {
          created_at: string
          governorate: string
          id: string
          office_id: string
          pickup_price: number | null
          price: number
        }
        Insert: {
          created_at?: string
          governorate: string
          id?: string
          office_id: string
          pickup_price?: number | null
          price?: number
        }
        Update: {
          created_at?: string
          governorate?: string
          id?: string
          office_id?: string
          pickup_price?: number | null
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "delivery_prices_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      diaries: {
        Row: {
          balance: number | null
          cash_arrived_entries: Json | null
          closed_at: string | null
          created_at: string
          diary_date: string
          diary_number: number
          id: string
          is_archived: boolean
          is_closed: boolean
          lock_status_updates: boolean
          manual_arrived_total: number | null
          office_id: string
          prevent_new_orders: boolean
          previous_due: number | null
          show_postponed_due: boolean | null
          updated_at: string
        }
        Insert: {
          balance?: number | null
          cash_arrived_entries?: Json | null
          closed_at?: string | null
          created_at?: string
          diary_date?: string
          diary_number?: number
          id?: string
          is_archived?: boolean
          is_closed?: boolean
          lock_status_updates?: boolean
          manual_arrived_total?: number | null
          office_id: string
          prevent_new_orders?: boolean
          previous_due?: number | null
          show_postponed_due?: boolean | null
          updated_at?: string
        }
        Update: {
          balance?: number | null
          cash_arrived_entries?: Json | null
          closed_at?: string | null
          created_at?: string
          diary_date?: string
          diary_number?: number
          id?: string
          is_archived?: boolean
          is_closed?: boolean
          lock_status_updates?: boolean
          manual_arrived_total?: number | null
          office_id?: string
          prevent_new_orders?: boolean
          previous_due?: number | null
          show_postponed_due?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "diaries_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      diary_orders: {
        Row: {
          created_at: string
          diary_id: string
          id: string
          manual_commission: number | null
          manual_return_amount: number | null
          manual_return_status: string | null
          manual_shipping: number | null
          n_column: string | null
          order_id: string
          partial_amount: number | null
          status_inside_diary: string | null
        }
        Insert: {
          created_at?: string
          diary_id: string
          id?: string
          manual_commission?: number | null
          manual_return_amount?: number | null
          manual_return_status?: string | null
          manual_shipping?: number | null
          n_column?: string | null
          order_id: string
          partial_amount?: number | null
          status_inside_diary?: string | null
        }
        Update: {
          created_at?: string
          diary_id?: string
          id?: string
          manual_commission?: number | null
          manual_return_amount?: number | null
          manual_return_status?: string | null
          manual_shipping?: number | null
          n_column?: string | null
          order_id?: string
          partial_amount?: number | null
          status_inside_diary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "diary_orders_diary_id_fkey"
            columns: ["diary_id"]
            isOneToOne: false
            referencedRelation: "diaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diary_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          created_by: string | null
          expense_date: string
          expense_name: string
          id: string
          notes: string | null
          office_id: string | null
        }
        Insert: {
          amount?: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          expense_date?: string
          expense_name: string
          id?: string
          notes?: string | null
          office_id?: string | null
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          expense_date?: string
          expense_name?: string
          id?: string
          notes?: string | null
          office_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          receiver_id: string
          sender_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          receiver_id: string
          sender_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          receiver_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      office_daily_closings: {
        Row: {
          closing_date: string
          created_at: string
          data_json: Json | null
          id: string
          is_closed: boolean
          is_locked: boolean
          office_id: string
          pickup_rate: number | null
          prevent_add: boolean
          updated_at: string
        }
        Insert: {
          closing_date?: string
          created_at?: string
          data_json?: Json | null
          id?: string
          is_closed?: boolean
          is_locked?: boolean
          office_id: string
          pickup_rate?: number | null
          prevent_add?: boolean
          updated_at?: string
        }
        Update: {
          closing_date?: string
          created_at?: string
          data_json?: Json | null
          id?: string
          is_closed?: boolean
          is_locked?: boolean
          office_id?: string
          pickup_rate?: number | null
          prevent_add?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "office_daily_closings_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      office_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          office_id: string
          type: string
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          office_id: string
          type?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          office_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "office_payments_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      offices: {
        Row: {
          address: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          owner_name: string | null
          owner_phone: string | null
          specialty: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          specialty?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          specialty?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      order_notes: {
        Row: {
          created_at: string
          id: string
          note: string
          order_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          note: string
          order_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          note?: string
          order_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_notes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_statuses: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      orders: {
        Row: {
          address: string | null
          barcode: string | null
          color: string | null
          company_id: string | null
          courier_id: string | null
          created_at: string
          customer_code: string | null
          customer_name: string
          customer_phone: string
          delivery_price: number
          id: string
          is_closed: boolean
          is_courier_closed: boolean
          is_settled: boolean
          notes: string | null
          office_id: string | null
          partial_amount: number | null
          price: number
          priority: string | null
          product_id: string | null
          product_name: string | null
          quantity: number
          shipping_paid: number | null
          size: string | null
          status_id: string | null
          tracking_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          barcode?: string | null
          color?: string | null
          company_id?: string | null
          courier_id?: string | null
          created_at?: string
          customer_code?: string | null
          customer_name: string
          customer_phone?: string
          delivery_price?: number
          id?: string
          is_closed?: boolean
          is_courier_closed?: boolean
          is_settled?: boolean
          notes?: string | null
          office_id?: string | null
          partial_amount?: number | null
          price?: number
          priority?: string | null
          product_id?: string | null
          product_name?: string | null
          quantity?: number
          shipping_paid?: number | null
          size?: string | null
          status_id?: string | null
          tracking_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          barcode?: string | null
          color?: string | null
          company_id?: string | null
          courier_id?: string | null
          created_at?: string
          customer_code?: string | null
          customer_name?: string
          customer_phone?: string
          delivery_price?: number
          id?: string
          is_closed?: boolean
          is_courier_closed?: boolean
          is_settled?: boolean
          notes?: string | null
          office_id?: string | null
          partial_amount?: number | null
          price?: number
          priority?: string | null
          product_id?: string | null
          product_name?: string | null
          quantity?: number
          shipping_paid?: number | null
          size?: string | null
          status_id?: string | null
          tracking_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "order_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          id: string
          name: string
          quantity: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          login_code: string | null
          office_id: string | null
          phone: string | null
          salary: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          login_code?: string | null
          office_id?: string | null
          phone?: string | null
          salary?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          login_code?: string | null
          office_id?: string | null
          phone?: string | null
          salary?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          created_at: string
          id: string
          permission: string
          section: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission?: string
          section: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission?: string
          section?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_old_activity_logs: { Args: never; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      log_activity: {
        Args: { _action: string; _details?: Json }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "courier" | "office"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["owner", "admin", "courier", "office"],
    },
  },
} as const
