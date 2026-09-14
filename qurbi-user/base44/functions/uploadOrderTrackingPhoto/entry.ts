Deno.serve(() => Response.json(
  { error: 'Farmer tracking proof uploads are not available through the User app.' },
  { status: 403 },
));
