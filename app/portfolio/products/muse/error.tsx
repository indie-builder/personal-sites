'use client';

import { PageError } from '@/components/portfolio/page-error';

export default function MuseError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <PageError
      reset={reset}
      title="灵感暂时无法打开"
      href="/portfolio/products/muse"
      returnLabel="返回灵感集"
    />
  );
}
