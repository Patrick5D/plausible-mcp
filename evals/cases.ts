export interface EvalCase {
  name: string;
  prompt: string;
  expectedTool: string;
  assertions: (args: Record<string, unknown>) => string[];
}

export const cases: EvalCase[] = [
  {
    name: "site discovery",
    prompt: "Which Plausible sites can this API key access?",
    expectedTool: "list_sites",
    assertions: () => [],
  },
  {
    name: "aggregate traffic summary",
    prompt: "Give me the total visitors, visits, pageviews, bounce rate, and duration for example.com in the last 30 days.",
    expectedTool: "get_aggregate",
    assertions: (args) => {
      const errors: string[] = [];
      if (args.date_range !== "30d" && !String(args.date_range).includes(",")) {
        errors.push(`Expected date_range "30d" or date pair, got "${args.date_range}"`);
      }
      return errors;
    },
  },
  {
    name: "realtime visitors",
    prompt: "How many people are on example.com right now?",
    expectedTool: "get_realtime_visitors",
    assertions: (args) => {
      const errors: string[] = [];
      if (!String(args.site_id ?? "").includes("example.com")) {
        errors.push(`Expected site_id to include "example.com", got "${args.site_id}"`);
      }
      return errors;
    },
  },
  {
    name: "goal discovery",
    prompt: "What goals are configured for example.com?",
    expectedTool: "get_goals",
    assertions: (args) => {
      const errors: string[] = [];
      if (!String(args.site_id ?? "").includes("example.com")) {
        errors.push(`Expected site_id to include "example.com", got "${args.site_id}"`);
      }
      return errors;
    },
  },
  {
    name: "before/after deploy comparison",
    prompt:
      "Did traffic to /pricing drop after March 15, 2024? Compare the week before and after.",
    expectedTool: "compare_periods",
    assertions: (args) => {
      const errors: string[] = [];
      if (!String(args.page ?? "").includes("/pricing")) {
        errors.push(`Expected page to include "/pricing", got "${args.page}"`);
      }
      if (!args.period_a || !args.period_b) {
        errors.push("Expected both period_a and period_b to be set");
      }
      return errors;
    },
  },
  {
    name: "daily visitors timeseries",
    prompt: "Show me daily visitors for example.com for the last 30 days.",
    expectedTool: "get_timeseries",
    assertions: (args) => {
      const errors: string[] = [];
      if (args.date_range !== "30d" && !String(args.date_range).includes(",")) {
        errors.push(`Expected date_range "30d" or date pair, got "${args.date_range}"`);
      }
      return errors;
    },
  },
  {
    name: "top pages breakdown",
    prompt: "What are our top pages by traffic this month for example.com?",
    expectedTool: "get_breakdown",
    assertions: (args) => {
      const errors: string[] = [];
      if (args.dimension !== "event:page") {
        errors.push(
          `Expected dimension "event:page", got "${args.dimension}"`
        );
      }
      return errors;
    },
  },
  {
    name: "conversion rate query",
    prompt:
      "What's the signup conversion rate on /pricing for example.com this month?",
    expectedTool: "get_conversions",
    assertions: (args) => {
      const errors: string[] = [];
      const goal = String(args.goal ?? "").toLowerCase();
      if (!goal.includes("signup")) {
        errors.push(`Expected goal to contain "signup", got "${args.goal}"`);
      }
      if (!String(args.page ?? "").includes("/pricing")) {
        errors.push(`Expected page to include "/pricing", got "${args.page}"`);
      }
      return errors;
    },
  },
  {
    name: "bounce rate week-over-week comparison",
    prompt:
      "How does this week's bounce rate compare to last week for /blog on example.com?",
    expectedTool: "compare_periods",
    assertions: (args) => {
      const errors: string[] = [];
      if (!String(args.page ?? "").includes("/blog")) {
        errors.push(`Expected page to include "/blog", got "${args.page}"`);
      }
      const metrics = args.metrics as string[] | undefined;
      if (metrics && !metrics.includes("bounce_rate")) {
        errors.push(
          `Expected metrics to include "bounce_rate", got ${JSON.stringify(metrics)}`
        );
      }
      return errors;
    },
  },
];
