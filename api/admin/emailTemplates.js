export function buildConnectEdEmailHtml({
  badgeType = "success", // 'success' | 'rejection' | 'info' | null
  title,
  subtitle,
  credentials = null, // { fullName, username, tempPassword, lrn, gradeSection }
  rejectionReason = null,
  loginUrl = "https://getconnectedlms.online/login",
  buttonText = "Log In to ConnectEd",
  showButton = true,
  securityNotice = null,
  footerText = "This is an automated notification from ConnectEd LMS."
}) {
  // Top Badge Icon (matching circular badge from Screenshot 3)
  let badgeHtml = "";
  if (badgeType === "success") {
    badgeHtml = `
      <div style="background-color: #d1fae5; width: 56px; height: 56px; border-radius: 50%; margin: 0 auto 20px auto; text-align: center; line-height: 56px;">
        <span style="color: #059669; font-size: 26px; font-weight: bold; line-height: 56px; display: inline-block;">✓</span>
      </div>
    `;
  } else if (badgeType === "rejection") {
    badgeHtml = `
      <div style="background-color: #fee2e2; width: 56px; height: 56px; border-radius: 50%; margin: 0 auto 20px auto; text-align: center; line-height: 56px;">
        <span style="color: #dc2626; font-size: 22px; font-weight: bold; line-height: 56px; display: inline-block;">✕</span>
      </div>
    `;
  }

  // Credentials Box (styled like Screenshot 3 callout box with left green border)
  let credentialsHtml = "";
  if (credentials) {
    credentialsHtml = `
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #10b981; border-radius: 8px; padding: 20px; margin: 24px 0; text-align: left;">
        <p style="margin: 0 0 12px 0; color: #0f172a; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Account Credentials</p>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #334155;">
          ${credentials.fullName ? `
          <tr>
            <td style="padding: 6px 0; font-weight: 600; color: #64748b; width: 140px;">Full Name:</td>
            <td style="padding: 6px 0; font-weight: 600; color: #0f172a;">${credentials.fullName}</td>
          </tr>` : ""}
          ${credentials.username ? `
          <tr>
            <td style="padding: 6px 0; font-weight: 600; color: #64748b;">Username:</td>
            <td style="padding: 6px 0;">
              <code style="font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 15px; font-weight: 700; color: #0f172a; background-color: #e2e8f0; padding: 3px 8px; border-radius: 4px; display: inline-block;">${credentials.username}</code>
            </td>
          </tr>` : ""}
          ${credentials.tempPassword ? `
          <tr>
            <td style="padding: 6px 0; font-weight: 600; color: #64748b;">Temporary Password:</td>
            <td style="padding: 6px 0;">
              <code style="font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 15px; font-weight: 700; color: #059669; background-color: #d1fae5; padding: 3px 8px; border-radius: 4px; display: inline-block;">${credentials.tempPassword}</code>
            </td>
          </tr>` : ""}
          ${credentials.lrn ? `
          <tr>
            <td style="padding: 6px 0; font-weight: 600; color: #64748b;">LRN:</td>
            <td style="padding: 6px 0; color: #334155;">${credentials.lrn}</td>
          </tr>` : ""}
          ${credentials.gradeSection ? `
          <tr>
            <td style="padding: 6px 0; font-weight: 600; color: #64748b;">Grade & Section:</td>
            <td style="padding: 6px 0; color: #334155;">${credentials.gradeSection}</td>
          </tr>` : ""}
        </table>
      </div>
    `;
  }

  // Rejection Reason Box (styled like Screenshot 3 warning box with left red border)
  let rejectionHtml = "";
  if (rejectionReason) {
    rejectionHtml = `
      <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid #ef4444; border-radius: 8px; padding: 18px 20px; margin: 24px 0; text-align: left;">
        <p style="margin: 0 0 6px 0; color: #991b1b; font-size: 14px; font-weight: 700;">Reason for Rejection:</p>
        <p style="margin: 0; color: #7f1d1d; font-size: 14px; line-height: 1.5;">${rejectionReason}</p>
      </div>
    `;
  }

  // Button HTML (styled like Screenshot 1 & 2 green button)
  let buttonHtml = "";
  if (showButton && loginUrl) {
    buttonHtml = `
      <div style="text-align: center; margin: 28px 0;">
        <a href="${loginUrl}" style="background-color: #16a34a; color: #ffffff; font-weight: 600; font-size: 15px; text-decoration: none; padding: 12px 32px; border-radius: 8px; display: inline-block; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);">
          ${buttonText}
        </a>
      </div>
    `;
  }

  // Security Notice Box
  let securityHtml = "";
  if (securityNotice) {
    securityHtml = `
      <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 14px 18px; margin: 20px 0; text-align: left;">
        <p style="margin: 0; color: #92400e; font-size: 13px; line-height: 1.5;">
          <strong>🔒 Security Reminder:</strong> ${securityNotice}
        </p>
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <div style="background-color: #f8fafc; width: 100%; padding: 40px 16px; box-sizing: border-box;">
    <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 40px 36px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); text-align: center;">
      ${badgeHtml}
      <h2 style="color: #0f172a; font-size: 24px; font-weight: 700; margin-top: 0; margin-bottom: 12px; text-align: center; letter-spacing: -0.5px;">${title}</h2>
      ${subtitle ? `<p style="color: #475569; font-size: 15px; line-height: 1.6; margin-top: 0; margin-bottom: 24px; text-align: center;">${subtitle}</p>` : ''}
      
      ${credentialsHtml}
      ${rejectionHtml}
      ${buttonHtml}
      ${securityHtml}
      
      <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 32px 0 20px 0;" />
      <p style="color: #94a3b8; font-size: 13px; line-height: 1.5; text-align: center; margin: 0;">
        ${footerText}
      </p>
    </div>
  </div>
</body>
</html>`;
}
