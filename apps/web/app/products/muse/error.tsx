'use client';

import { createProductError } from '@/lib/portfolio/product-error';

export default createProductError({
  title: '灵感暂时无法打开',
  href: '/products/muse',
  returnLabel: '返回灵感集',
});
