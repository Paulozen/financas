import { Shell } from "@/components/shell";

export default function LayoutApp({ children }: LayoutProps<"/">) {
  return <Shell>{children}</Shell>;
}
