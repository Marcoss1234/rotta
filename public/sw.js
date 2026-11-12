// Solo recibe avisos: no guarda nada en caché, así la app siempre se carga actualizada.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data.json();
  } catch {
    // Sin datos legibles se avisa igual: iPhone retira el permiso si un aviso no se enseña.
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Rotta", {
      body: data.body || "",
      icon: "/rotta-logo.svg",
      badge: "/rotta-logo.svg",
      tag: data.tag,
      data: { url: data.url || "/app" },
    }),
  );
});

async function openApp(url) {
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  const open = windows.find((client) => new URL(client.url).pathname.startsWith("/app"));
  if (!open) return self.clients.openWindow(url);
  await open.focus();
  try {
    return await open.navigate(url);
  } catch {
    return self.clients.openWindow(url);
  }
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(openApp(new URL(event.notification.data?.url || "/app", self.location.origin).href));
});
