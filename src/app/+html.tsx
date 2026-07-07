import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * Root HTML document for every web page (static-rendered by expo-router).
 * Only runs in the web build — native is unaffected. Gives the site a real
 * static <title> so the browser tab and link previews read "Jelli" on first
 * paint, before the client fills in per-screen titles.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <title>Jelli</title>
        <meta name="description" content="Jelli — a social music-rating app." />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
