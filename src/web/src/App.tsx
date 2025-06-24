import { useState } from "react"
import { Board } from "./components/Board"
import { TaskList } from "./components/TaskList"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs"
import { Button } from "./components/ui/button"
import { Plus } from "lucide-react"

function App() {
	const [activeTab, setActiveTab] = useState("board")

	return (
		<div className="min-h-screen bg-background">
			<header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
				<div className="container mx-auto px-4 py-4">
					<div className="flex items-center justify-between">
						<h1 className="text-2xl font-bold">Backlog.md</h1>
						<Button>
							<Plus className="h-4 w-4 mr-2" />
							New Task
						</Button>
					</div>
				</div>
			</header>

			<main className="container mx-auto px-4 py-6">
				<Tabs value={activeTab} onValueChange={setActiveTab}>
					<TabsList className="grid w-full grid-cols-2 max-w-md">
						<TabsTrigger value="board">Board</TabsTrigger>
						<TabsTrigger value="list">List</TabsTrigger>
					</TabsList>
					
					<TabsContent value="board" className="mt-6">
						<Board />
					</TabsContent>
					
					<TabsContent value="list" className="mt-6">
						<TaskList />
					</TabsContent>
				</Tabs>
			</main>
		</div>
	)
}

export default App