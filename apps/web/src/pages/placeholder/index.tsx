import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

type PlaceholderPageProps = {
  title: string
  description?: string
}

export function PlaceholderPage({
  title,
  description = "This route is ready for the next feature module.",
}: PlaceholderPageProps) {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Add the page implementation here while keeping the sidebar and
            layout stable.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
