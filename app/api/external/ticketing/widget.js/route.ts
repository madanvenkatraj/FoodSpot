import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/store';
import { getYantraCorsHeaders } from '@/lib/db/security';

export async function GET() {
  const db = getDb();
  const scriptContent = `/**
 * Yantra Ticketing Agent — Official Support Widget Loader
 * Platform: Yantra - Your AI Co-Founder Team
 * Connected Application: FoodHub
 * Needs no key in the request: reads the key from its own data-api-key attribute.
 */
(function(window, document) {
  var currentScript = document.currentScript || document.querySelector('script[data-api-key]');
  var apiKey = currentScript ? currentScript.getAttribute('data-api-key') : ${JSON.stringify(db.yantraConfig.apiKey)};

  window.YantraSupportWidget = {
    version: "2.5.0",
    platform: "Yantra - Your AI Co-Founder Team",
    apiKey: apiKey,
    title: ${JSON.stringify(db.yantraConfig.supportTitle)},
    welcomeMessage: ${JSON.stringify(db.yantraConfig.welcomeMessage)},
    endpoints: {
      config: "/api/external/ticketing/widget-config",
      tickets: "/api/external/ticketing/tickets",
      legacySubmit: "/api/tickets/submit"
    },
    open: function(options) {
      window.dispatchEvent(new CustomEvent("yantra:open-widget", { detail: options || {} }));
    },
    close: function() {
      window.dispatchEvent(new CustomEvent("yantra:close-widget"));
    }
  };

  if (apiKey) {
    fetch("/api/external/ticketing/widget-config", {
      headers: { "x-api-key": apiKey }
    })
      .then(function(r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function(cfg) {
        window.YantraSupportWidget.config = cfg.widget;
        window.dispatchEvent(new CustomEvent("yantra:widget-loaded", { detail: window.YantraSupportWidget }));
      })
      .catch(function(err) {
        window.dispatchEvent(new CustomEvent("yantra:widget-error", { detail: { status: err } }));
      });
  }
})(window, document);
`;

  return new NextResponse(scriptContent, {
    status: 200,
    headers: {
      ...getYantraCorsHeaders(),
      'Content-Type': 'application/javascript; charset=utf-8',
    },
  });
}
