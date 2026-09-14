import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function requiredString(value: unknown) {
  return typeof value === 'string' && Boolean(value.trim());
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const applicantEmail = normalizeEmail(user.email || user.data?.email);
    if (!applicantEmail) return Response.json({ error: 'Your authenticated account does not have an email address' }, { status: 400 });

    const { profile, verification } = await req.json().catch(() => ({}));
    const requiredProfile = [profile?.phoneNumber, profile?.icNumber, profile?.farmName, profile?.address, profile?.state, profile?.deliveryPreference];
    const requiredVerification = [verification?.icFront, verification?.icBack, verification?.selfieImage, verification?.policySignerName, verification?.policySignedDate, verification?.policySignature, verification?.policyVersion];
    if (!requiredProfile.every(requiredString) || !requiredVerification.every(requiredString) || !Array.isArray(verification?.policyConsents) || !verification.policyConsents.length) {
      return Response.json({ error: 'Required farmer registration details are incomplete' }, { status: 400 });
    }

    // Service-role read is required because normal RLS only exposes the current
    // userId. Compare normalized authenticated email as the cross-session key.
    const pendingRows = await base44.asServiceRole.entities.FarmVerification.filter({ status: 'Pending' }, '-created_date', 500);
    const existingPending = (pendingRows || []).find((row) =>
      row.userId === user.id || normalizeEmail(row.applicantEmail || row.applicantEmailNormalized) === applicantEmail
    );

    if (existingPending) {
      await base44.auth.updateMe({ verificationStatus: 'Pending' });
      return Response.json({ created: false, duplicate: true, status: 'Pending' });
    }

    const profileData = {
      applicantEmail,
      applicantEmailNormalized: applicantEmail,
      phoneNumber: profile.phoneNumber.trim(),
      icNumber: profile.icNumber.trim(),
      farmName: profile.farmName.trim(),
      address: profile.address.trim(),
      state: profile.state,
      deliveryPreference: profile.deliveryPreference,
    };
    const profiles = await base44.entities.FarmerProfile.filter({ userId: user.id }, '-created_date', 1);
    if (profiles?.length) await base44.entities.FarmerProfile.update(profiles[0].id, profileData);
    else await base44.entities.FarmerProfile.create({ userId: user.id, ...profileData });

    const verificationData: Record<string, unknown> = {
      userId: user.id,
      applicantEmail,
      applicantEmailNormalized: applicantEmail,
      icFront: verification.icFront,
      icBack: verification.icBack,
      selfieImage: verification.selfieImage,
      identityReviewMethod: 'Manual',
      policySignerName: verification.policySignerName.trim(),
      policySignedDate: verification.policySignedDate,
      policySignature: verification.policySignature,
      policyVersion: verification.policyVersion,
      policyAcceptedAt: new Date().toISOString(),
      policyConsents: verification.policyConsents,
      status: 'Pending',
    };
    if (requiredString(verification.farmerCertificate)) verificationData.farmerCertificate = verification.farmerCertificate;

    const created = await base44.entities.FarmVerification.create(verificationData);
    await base44.auth.updateMe({ name: verification.policySignerName.trim(), verificationStatus: 'Pending' });
    return Response.json({ created: true, duplicate: false, status: 'Pending', verificationId: created.id });
  } catch (error) {
    console.error('submitFarmerVerification error:', error.message);
    return Response.json({ error: 'Unable to submit farmer registration' }, { status: 500 });
  }
});
