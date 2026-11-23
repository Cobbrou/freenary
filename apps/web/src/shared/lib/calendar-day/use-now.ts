import { useMemo } from "react";

const readNow = () => new Date();

export const useNow = (): Date => useMemo(() => readNow(), []);
