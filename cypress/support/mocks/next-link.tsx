import React from "react";

/**
 * Mock Next.js Link component for Cypress/Vite environment.
 *
 * Next.js Link requires router context which isn't available in Cypress component tests.
 * This mock renders a plain `<a>` tag that preserves the href and click behavior.
 */
const Link = React.forwardRef<
  HTMLAnchorElement,
  React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }
>(function Link({ href, children, ...props }, ref) {
  return (
    <a ref={ref} href={href} {...props}>
      {children}
    </a>
  );
});

export default Link;
