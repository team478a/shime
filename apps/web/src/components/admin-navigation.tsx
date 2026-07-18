"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { AdminNavigationGroup, AdminNavigationItem } from "../lib/admin-navigation";

function isCurrentPath(pathname: string, href: string) {
  return pathname === href;
}

export function AdminPrimaryNavigation({ items }: Readonly<{ items: readonly AdminNavigationItem[] }>) {
  const pathname = usePathname();

  return (
    <nav className="admin-primary-nav" aria-label="管理画面メインメニュー">
      <div className="admin-primary-nav-inner admin-primary-nav-desktop">
        {items.map((item) => (
          <Link key={item.key} href={item.href} aria-current={isCurrentPath(pathname, item.href) ? "page" : undefined}>
            {item.label}
          </Link>
        ))}
      </div>
      <details className="admin-primary-nav-mobile">
        <summary>管理メニュー</summary>
        <div>
          {items.map((item) => (
            <Link key={item.key} href={item.href} aria-current={isCurrentPath(pathname, item.href) ? "page" : undefined}>
              {item.label}
            </Link>
          ))}
        </div>
      </details>
    </nav>
  );
}

export function AdminEventNavigation({ groups }: Readonly<{ groups: readonly AdminNavigationGroup[] }>) {
  const pathname = usePathname();

  const navigation = (className: string) => (
    <nav className={className} aria-label="イベント管理メニュー">
      {groups.map((group) => (
        <section className="admin-event-nav-group" key={group.key}>
          <h3>{group.label}</h3>
          <ul>
            {group.items.map((item) => (
              <li key={item.key}>
                <Link href={item.href} aria-current={isCurrentPath(pathname, item.href) ? "page" : undefined}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  );

  return (
    <>
      {navigation("admin-event-nav admin-event-nav-desktop")}
      <details className="admin-event-nav-mobile">
        <summary>イベント操作メニュー</summary>
        {navigation("admin-event-nav")}
      </details>
    </>
  );
}
