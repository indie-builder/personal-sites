'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { buttonClassName } from './button';
import type { ComponentProps } from 'react';

// 源站 WorkspaceLink 只包装路由动画；这里保留 Next Link 原生行为（预取、修饰键点击、返回）。
// 迁移组件以字符串传 href；typedRoutes 收口在这一处断言。
export function WorkspaceLink({
  href,
  ...props
}: Omit<ComponentProps<typeof Link>, 'href' | 'onNavigate'> & { href: string }) {
  return <Link {...props} href={href as Route} />;
}

/** 阅读面顶部的返回控件：源外壳标题按钮在此改为可见按钮。 */
export function WorkspaceBack({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <button type="button" className={buttonClassName({ variant: 'ghost' })} onClick={onBack} aria-label={label}>
      {label}
    </button>
  );
}
