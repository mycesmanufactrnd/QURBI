import React, { useEffect, useState } from "react";

function initialsFor(name) {
  return String(name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "?";
}

export default function ProfileAvatar({
  src = "",
  name = "",
  className = "h-10 w-10 rounded-full",
  imageClassName = "",
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const label = name ? `${name} profile picture` : "Profile picture";

  return (
    <span
      className={`flex flex-none items-center justify-center overflow-hidden border border-white/25 bg-white/15 font-extrabold text-white shadow-sm ${className}`}
      aria-label={label}
      role="img"
    >
      {src && !failed ? (
        <img
          src={src}
          alt=""
          data-no-contrast-outline
          referrerPolicy="no-referrer"
          className={`h-full w-full object-cover ${imageClassName}`}
          onError={() => setFailed(true)}
        />
      ) : (
        <span aria-hidden="true">{initialsFor(name)}</span>
      )}
    </span>
  );
}
