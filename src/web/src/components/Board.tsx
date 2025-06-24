import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"

export function Board() {
	return (
		<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
			<Card>
				<CardHeader>
					<CardTitle className="text-lg">To Do</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-2">
						<div className="p-3 bg-muted rounded-md">
							<p className="font-medium">Sample Task 1</p>
							<p className="text-sm text-muted-foreground">task-1</p>
						</div>
						<div className="p-3 bg-muted rounded-md">
							<p className="font-medium">Sample Task 2</p>
							<p className="text-sm text-muted-foreground">task-2</p>
						</div>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="text-lg">In Progress</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-2">
						<div className="p-3 bg-muted rounded-md">
							<p className="font-medium">Sample Task 3</p>
							<p className="text-sm text-muted-foreground">task-3</p>
						</div>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="text-lg">Done</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-2">
						<div className="p-3 bg-muted rounded-md">
							<p className="font-medium">Sample Task 4</p>
							<p className="text-sm text-muted-foreground">task-4</p>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	)
}