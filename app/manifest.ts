import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Fominha",
    short_name: "Fominha",
    description: "Quem come mais no rodízio? Agora tem placar.",
    start_url: "/",
    display: "standalone",
    background_color: "#d33d15",
    theme_color: "#d33d15",
    lang: "pt-BR",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
