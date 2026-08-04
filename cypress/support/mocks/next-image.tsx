/**
 * Mock `next/image` for Cypress/Vite component tests.
 *
 * Renders a plain `<img>` — Next.js Image optimization and loader config are
 * unavailable outside the Next dev/build pipeline.
 */
import React from "react";

const Image = ({
  src,
  alt,
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement> & { src: string; alt: string }) => {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} {...props} />;
};

export default Image;
