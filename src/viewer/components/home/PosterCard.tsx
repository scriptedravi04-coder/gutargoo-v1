import { Link } from "react-router-dom";
import clsx from "clsx";
import { detailPath, Item } from "@v/lib/content";
import { Img } from "@v/components/Img";
import { LockBadge } from "@v/components/LockBadge";

// A tappable poster/banner image that opens the title's detail page.
export function PosterCard({
  item,
  image,
  className,
  imgClassName,
}: {
  item: Item;
  image?: string;
  className?: string;
  imgClassName?: string;
}) {
  return (
    <Link to={detailPath(item)} draggable={false} className={clsx("relative block shrink-0 overflow-hidden", className)} aria-label={item.title}>
      <Img src={image ?? item.poster} alt={item.title} className={clsx("h-full w-full", imgClassName)} />
      {!item.isFree && <LockBadge />}
    </Link>
  );
}
