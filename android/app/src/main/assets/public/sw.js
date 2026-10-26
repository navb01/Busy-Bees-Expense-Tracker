/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-7e5eb42b'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "registerSW.js",
    "revision": "1872c500de691dce40960bb85481de07"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "a86606745673415e5f0ab884b25808b9"
  }, {
    "url": "pwa-512x512.png",
    "revision": "a86606745673415e5f0ab884b25808b9"
  }, {
    "url": "pwa-192x192.png",
    "revision": "a8daa7648b215ee9a586deef0a568aee"
  }, {
    "url": "index.html",
    "revision": "81f23430a3572e8d4c6ef99a3c6707f3"
  }, {
    "url": "icon.svg",
    "revision": "885a09fc26694e0c9ec1ec7ece7fff5e"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "49e78166c20708f124ed1777c0e31a37"
  }, {
    "url": "assets/index-CcfVJmqU.css",
    "revision": null
  }, {
    "url": "assets/index-B51xp6Sa.js",
    "revision": null
  }, {
    "url": "assets/aistudio/error4_d204b4cb.png",
    "revision": null
  }, {
    "url": "assets/aistudio/error3_b70286e6.png",
    "revision": null
  }, {
    "url": "assets/aistudio/error2_37f034a3.png",
    "revision": null
  }, {
    "url": "assets/aistudio/error1_8642e251.png",
    "revision": null
  }, {
    "url": "assets/aistudio/9_fe526e17.png",
    "revision": null
  }, {
    "url": "assets/aistudio/8_c7961b85.png",
    "revision": null
  }, {
    "url": "assets/aistudio/7_ef012101.png",
    "revision": null
  }, {
    "url": "assets/aistudio/6_00911e23.png",
    "revision": null
  }, {
    "url": "assets/aistudio/5_94f5df37.png",
    "revision": null
  }, {
    "url": "assets/aistudio/4_1d20693f.png",
    "revision": null
  }, {
    "url": "assets/aistudio/3_607cd6ee.png",
    "revision": null
  }, {
    "url": "assets/aistudio/2_f2bee520.png",
    "revision": null
  }, {
    "url": "assets/aistudio/1_4d7fb350.png",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "49e78166c20708f124ed1777c0e31a37"
  }, {
    "url": "icon.svg",
    "revision": "885a09fc26694e0c9ec1ec7ece7fff5e"
  }, {
    "url": "pwa-192x192.png",
    "revision": "a8daa7648b215ee9a586deef0a568aee"
  }, {
    "url": "pwa-512x512.png",
    "revision": "a86606745673415e5f0ab884b25808b9"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "a86606745673415e5f0ab884b25808b9"
  }, {
    "url": "manifest.webmanifest",
    "revision": "b7673a56afbb9edb802779415a73c4e2"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));

}));
