
"use client";
import { useLoading } from "@/contexts/LoadingProvider";
import { Link, type LinkProps, useNavigate } from "react-router-dom";
import React, { type ReactNode } from "react";

interface NavLinkProps extends Omit<LinkProps, 'href'> {
    children: ReactNode;
    className?: string;
    onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
    to: string;
}

export function NavLink({ children, ...props }: NavLinkProps) {
  const { setIsLoading } = useLoading();
  const navigate = useNavigate();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (props.onClick) {
      props.onClick(e);
    }

    // Check for modifier keys to allow opening in new tab
    if (e.ctrlKey || e.metaKey || e.shiftKey) {
        return;
    }

    e.preventDefault();
    setIsLoading(true);
    navigate(props.to);
  };

  return (
    <Link {...props} onClick={handleClick}>
      {children}
    </Link>
  );
}
