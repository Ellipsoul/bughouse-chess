import React from "react";

// Mock Next.js Image component for Cypress/Vite environment
const Image = ({
  src,
  alt,
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement> & { src: string; alt: string }) => {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} {...props} />;
};

export default Image;

