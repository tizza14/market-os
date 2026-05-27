<template>
  <div class="min-h-screen bg-bg-primary">
    <nav class="border-b border-border-dim px-4 md:px-6 flex gap-1 h-10 items-center">
      <RouterLink
        to="/"
        class="px-3 py-1 text-xs rounded font-medium transition-colors"
        :class="$route.path === '/' ? 'bg-teal-600 text-white' : 'text-price-flat hover:text-white hover:bg-white/10'"
      >
        BTC 即時
      </RouterLink>
      <RouterLink
        to="/tw-stock"
        class="px-3 py-1 text-xs rounded font-medium transition-colors"
        :class="$route.path === '/tw-stock' ? 'bg-teal-600 text-white' : 'text-price-flat hover:text-white hover:bg-white/10'"
      >
        台股日K
      </RouterLink>
    </nav>
    <RouterView />
  </div>
</template>
