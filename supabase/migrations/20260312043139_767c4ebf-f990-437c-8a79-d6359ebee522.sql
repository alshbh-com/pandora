UPDATE auth.users SET email = REPLACE(email, '@first.ship', '@modex.ship') WHERE email LIKE '%@first.ship';
DELETE FROM auth.users WHERE id = 'b5157df7-b5b1-4190-b803-05b14daf1c23';