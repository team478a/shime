# Initial administrator bootstrap

Use this procedure only to create the first tenant-level `system_admin`. It does not create an event or participant data.

## Required local environment

- `APP_ENV=staging`
- `DATABASE_MIGRATION_URL`
- `PASSWORD_PEPPER`
- `SEED_ADMIN_PASSWORD` or `BOOTSTRAP_ADMIN_PASSWORD`
- `BOOTSTRAP_TENANT_CODE` (default: `shime`)
- `BOOTSTRAP_TENANT_NAME` (default: `SHIME`)
- `BOOTSTRAP_ADMIN_LOGIN_ID` (default: `admin`)
- `BOOTSTRAP_ADMIN_DISPLAY_NAME`

Do not add the bootstrap password or migration connection to Vercel.

## Run

```powershell
pnpm db:bootstrap-admin
```

The command is idempotent. A repeated run does not replace the existing password unless `BOOTSTRAP_ROTATE_PASSWORD=true` is set explicitly. Production requires `BOOTSTRAP_CONFIRM_PRODUCTION` to exactly match the tenant code.

After a successful login, remove any temporary `BOOTSTRAP_ADMIN_PASSWORD` value and keep the password in an approved password manager.
