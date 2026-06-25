import { Link } from "react-router-dom"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

export function NotFoundPage() {
  return (
    <div className="flex flex-1 items-center justify-center p-4 md:p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Page not found</CardTitle>
          <CardDescription>
            The route you opened does not exist in this application.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Return to the dashboard or add this path to the route configuration.
          </p>
        </CardContent>
        <CardFooter>
          <Button asChild>
            <Link to="/dashboard">Back to dashboard</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
