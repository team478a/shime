export type TenantScope = Readonly<{ tenantId: string; eventId?: string }>;

export function requireSameTenant(scope: TenantScope, resourceTenantId: string): void {
  if (scope.tenantId !== resourceTenantId) throw new Error("Resource not found");
}

export function requireSameEvent(scope: TenantScope, resourceEventId: string): void {
  if (!scope.eventId || scope.eventId !== resourceEventId) throw new Error("Resource not found");
}
