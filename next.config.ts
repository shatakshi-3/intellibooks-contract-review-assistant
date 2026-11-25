import { withWorkflow } from "workflow/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["unpdf", "pdf-parse", "mammoth"],
};

export default withWorkflow(nextConfig);


