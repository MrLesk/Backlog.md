import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"

export function TaskList() {
	return (
		<Card>
			<CardHeader>
				<CardTitle>All Tasks</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					<div className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 border rounded-md">
						<div>
							<p className="font-medium">task-1</p>
						</div>
						<div>
							<p>Sample Task 1</p>
						</div>
						<div>
							<span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
								To Do
							</span>
						</div>
						<div>
							<span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800">
								Medium
							</span>
						</div>
						<div>
							<p className="text-sm text-muted-foreground">@user</p>
						</div>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 border rounded-md">
						<div>
							<p className="font-medium">task-2</p>
						</div>
						<div>
							<p>Sample Task 2</p>
						</div>
						<div>
							<span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-800">
								In Progress
							</span>
						</div>
						<div>
							<span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-red-100 text-red-800">
								High
							</span>
						</div>
						<div>
							<p className="text-sm text-muted-foreground">@developer</p>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	)
}