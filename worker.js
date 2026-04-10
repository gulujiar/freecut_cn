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

    try {
      if (isStatic) {
        // 静态资源直接代理
        if (env.ASSETS) {
          return env.ASSETS.fetch(request);
        }
        // 如果没有 ASSETS，直接返回请求（用于 Pages 环境）
        return fetch(request);
      }

      // SPA 路由：所有其他路径都返回 index.html
      const indexUrl = new URL('/', request.url);
      const indexRequest = new Request(indexUrl, request);
      
      if (env.ASSETS) {
        return env.ASSETS.fetch(indexRequest);
      }
      
      // Pages 环境下直接获取 index.html
      const indexHtmlRequest = new Request(new URL('/index.html', request.url), request);
      return fetch(indexHtmlRequest);
    } catch (e) {
      // 出错时返回简单的错误响应
      return new Response('Internal Server Error', { status: 500 });
    }
  }
};
