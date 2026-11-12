"use client";

// Lien de navigation avec retour de pression Motion (scale 0,97, DESIGN.md § 7). Navigation instantanée.
import { motion } from "motion/react";
import Link from "next/link";

const MotionLink = motion.create(Link);

type NavLinkProps = {
  href: string;
  active: boolean;
  className: string;
  children: React.ReactNode;
};

export function NavLink({ href, active, className, children }: NavLinkProps) {
  return (
    <MotionLink
      href={href}
      aria-current={active ? "page" : undefined}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.1, ease: "easeOut" }}
      className={className}
    >
      {children}
    </MotionLink>
  );
}
