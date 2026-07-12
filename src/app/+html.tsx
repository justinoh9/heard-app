import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * Root HTML document for every web page (static-rendered by expo-router).
 * Only runs in the web build — native is unaffected. Carries the site-wide
 * SEO + social-card meta (every route shares one OG card for now) and the
 * AdSense loader, which only ships when EXPO_PUBLIC_ADSENSE_CLIENT is set —
 * the per-placement gate lives in components/ad-slot.tsx.
 */
const SITE_URL = 'https://myjelli.site';
const SOCIAL_TITLE = 'Jelli — rank the music you love';
const DESCRIPTION =
  'Jelli is a social music app: rank songs and albums with head-to-head matchups, match tastes with friends, log concerts, and get a Wrapped-style recap anytime.';

const ADSENSE_CLIENT = process.env.EXPO_PUBLIC_ADSENSE_CLIENT;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <title>Jelli</title>
        <meta name="description" content={DESCRIPTION} />
        {/* vinyl palette background — keeps the browser chrome on-brand */}
        <meta name="theme-color" content="#140D0E" />

        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Jelli" />
        <meta property="og:title" content={SOCIAL_TITLE} />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:url" content={SITE_URL} />
        <meta property="og:image" content={`${SITE_URL}/og.png`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={SOCIAL_TITLE} />
        <meta name="twitter:description" content={DESCRIPTION} />
        <meta name="twitter:image" content={`${SITE_URL}/og.png`} />

        {ADSENSE_CLIENT && (
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
            crossOrigin="anonymous"
          />
        )}
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
