export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // 检查是否是静态资源
    const isStatic = 
      pathname.endsWith('.html') || 
      pathname.endsWith('.css') || 
      pathname.endsWith('.js') || 
      pathname.endsWith('.json') ||
      pathname.endsWith('.png') ||
      pathname.endsWith('.jpg') ||
      pathname.endsWith('.jpeg') ||
      pathname.endsWith('.gif') ||
      pathname.endsWith('.svg') ||
      pathname.endsWith('.ico') ||
      pathname.endsWith('.woff') ||
      pathname.endsWith('.woff2') ||
      pathname.endsWith('.ttf') ||
      pathname.endsWith('.eot') ||
      pathname.endsWith('.mp4') ||
      pathname.endsWith('.webm') ||
      pathname.endsWith('.mp3') ||
      pathname.endsWith('.wav') ||
      pathname.endsWith('.wasm') ||
      pathname.includes('/assets/');

    if (isStatic) {
      // 静态资源直接代理
      return env.ASSETS.fetch(request);
    }

    // SPA 路由：所有其他路径都返回 index.html
    const indexUrl = new URL('/', request.url);
    const indexRequest = new Request(indexUrl, request);
    return env.ASSETS.fetch(indexRequest);
  }
};
