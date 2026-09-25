'use client';

import { PageError } from '@/components/portfolio/page-error';

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <PageError reset={reset} />;
}
