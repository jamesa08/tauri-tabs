import { createContext, useState } from "react";

type DataContextType = {
    data: number;
    setData: (data: number) => void;
};
export const DataContext = createContext<null | DataContextType>(null);

const DataContextProvider = (props: any) => {
    const [state, setData] = useState(0);

    return <DataContext.Provider value={{ state, setData }}></DataContext.Provider>;
};

export default DataContextProvider;
