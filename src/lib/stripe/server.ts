export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      disabled: true,
      error: "Stripe checkout is temporarily disabled.",
    },
    { status: 503 }
  );
}

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      disabled: true,
      error: "Stripe checkout is temporarily disabled.",
    },
    { status: 503 }
  );
}
