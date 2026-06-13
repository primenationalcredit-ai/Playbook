// SendGrid Email Function for Survey Delivery
// Sends enrollment and completion surveys to clients

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = 'info@asapcreditrepairusa.com';
const FROM_NAME = 'ASAP Credit Repair';
const APP_URL = process.env.URL || 'https://asap-playbook.netlify.app';

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      headers, 
      body: JSON.stringify({ error: 'Method not allowed' }) 
    };
  }

  if (!SENDGRID_API_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'SendGrid API key not configured' })
    };
  }

  try {
    const body = JSON.parse(event.body);
    const { 
      type, // 'enrollment' or 'completion'
      client_name,
      client_email,
      consultant_name,
      consultant_id,
      pipedrive_person_id,
      pipedrive_deal_id
    } = body;

    if (!type || !client_email || !client_name) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields: type, client_email, client_name' })
      };
    }

    // Build survey URL with parameters
    const surveyParams = new URLSearchParams({
      name: client_name,
      email: client_email,
      ...(consultant_name && { consultant: consultant_name }),
      ...(consultant_id && { consultant_id }),
      ...(pipedrive_person_id && { person_id: pipedrive_person_id }),
      ...(pipedrive_deal_id && { deal_id: pipedrive_deal_id })
    });

    const surveyUrl = `${APP_URL}/survey/${type}?${surveyParams.toString()}`;

    // Get email template
    const emailContent = type === 'enrollment' 
      ? getEnrollmentEmail(client_name, consultant_name, surveyUrl)
      : getCompletionEmail(client_name, surveyUrl);

    // Send via SendGrid
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: client_email, name: client_name }]
        }],
        from: { email: FROM_EMAIL, name: FROM_NAME },
        subject: emailContent.subject,
        content: [
          { type: 'text/html', value: emailContent.html }
        ],
        tracking_settings: {
          click_tracking: { enable: true },
          open_tracking: { enable: true }
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('SendGrid error:', errorText);
      throw new Error(`SendGrid error: ${response.status}`);
    }

    // Get message ID from response headers
    const messageId = response.headers.get('x-message-id');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `${type} survey email sent to ${client_email}`,
        messageId,
        surveyUrl
      })
    };

  } catch (error) {
    console.error('Email send error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};

// Enrollment Survey Email Template
function getEnrollmentEmail(clientName, consultantName, surveyUrl) {
  return {
    subject: 'Welcome to ASAP Credit Repair - Quick Survey (30 seconds)',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Welcome to the Family!</h1>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Hi ${clientName},
              </p>
              
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Thank you for choosing ASAP Credit Repair! We're excited to help you on your credit repair journey.
              </p>
              
              ${consultantName ? `
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Your consultant <strong>${consultantName}</strong> has enrolled you in our program. Before we dive in, we'd love to hear about your initial experience.
              </p>
              ` : ''}
              
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                <strong>It only takes 30 seconds!</strong>
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center">
                    <a href="${surveyUrl}" 
                       style="display: inline-block; background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 8px; font-size: 18px; font-weight: bold;">
                      📝 Take Quick Survey
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0; text-align: center;">
                Your feedback helps us provide the best possible service.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #e9ecef;">
              <p style="color: #666666; font-size: 12px; margin: 0 0 10px 0;">
                ASAP Credit Repair USA<br>
                Helping you achieve your credit goals since 2013
              </p>
              <p style="color: #999999; font-size: 11px; margin: 0;">
                If you have any questions, reply to this email or call us at (855) 445-9222
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `
  };
}

// Completion Survey Email Template
function getCompletionEmail(clientName, surveyUrl) {
  return {
    subject: 'Congratulations! 🎉 How did we do?',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 30px; text-align: center;">
              <div style="font-size: 50px; margin-bottom: 10px;">🎉</div>
              <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Congratulations on Your Success!</h1>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Hi ${clientName},
              </p>
              
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                <strong>You did it!</strong> You've completed your credit repair journey with ASAP Credit Repair. We're so proud of how far you've come.
              </p>
              
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Before you go, we'd love to hear about your experience. Your feedback helps us serve future clients better.
              </p>
              
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                <strong>It only takes 30 seconds!</strong>
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center">
                    <a href="${surveyUrl}" 
                       style="display: inline-block; background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 8px; font-size: 18px; font-weight: bold;">
                      ⭐ Share Your Experience
                    </a>
                  </td>
                </tr>
              </table>
              
              <div style="background-color: #f0fdf4; border-radius: 8px; padding: 20px; margin-top: 30px; text-align: center;">
                <p style="color: #166534; font-size: 14px; margin: 0 0 10px 0; font-weight: bold;">
                  Happy with your results?
                </p>
                <a href="https://g.page/r/CYLuVnvYqXAzEBM/review" style="color: #15803d; font-size: 14px;">
                  Leave us a Google review! ⭐
                </a>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #e9ecef;">
              <p style="color: #666666; font-size: 12px; margin: 0 0 10px 0;">
                ASAP Credit Repair USA<br>
                Thank you for trusting us with your credit journey!
              </p>
              <p style="color: #999999; font-size: 11px; margin: 0;">
                Need help in the future? We're always here for you.<br>
                Call us at (855) 445-9222
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `
  };
}
