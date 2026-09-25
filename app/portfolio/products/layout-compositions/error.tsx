'use client';

import { PageError } from '@/components/portfolio/page-error';

export default function LayoutCompositionsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <PageError
      reset={reset}
      title="布局参考暂时无法打开"
      href="/portfolio/products/layout-compositions"
      returnLabel="返回布局参考"
    />
  );
}
