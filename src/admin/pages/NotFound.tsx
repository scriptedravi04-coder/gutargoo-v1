import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const NotFound = () => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <div className="text-center">
      <h1 className="mb-2 text-4xl font-bold">404</h1>
      <p className="mb-5 text-muted-foreground">This page doesn't exist.</p>
      <Button asChild>
        <Link to="/">Go to dashboard</Link>
      </Button>
    </div>
  </div>
);

export default NotFound;
