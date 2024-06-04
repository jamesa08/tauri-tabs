import TabBar from "./TabBar.tsx";
import "./App.css";

function App() {
    return (
        <div className="App">
            <div className="text">the drag zone</div>
            <TabBar defaultTabs={["1", "2", "3"]} />
        </div>
    );
}

export default App;
