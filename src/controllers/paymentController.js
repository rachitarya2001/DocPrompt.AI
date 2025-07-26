// controllers/paymentController.js
const User = require('../models/User');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.createPaymentSession = async (req, res) => {
    try {

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: 'DocuPrompt Pro Upgrade',
                        description: 'Unlock 20 messages per day',
                    },
                    unit_amount: 200,
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `${process.env.FRONTEND_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.FRONTEND_URL}/payment-cancelled`,
            metadata: {
                userId: req.user._id.toString(),
                email: req.user.email
            }
        });

        res.json({
            success: true,
            sessionId: session.id,
            checkoutUrl: session.url,
            message: 'Stripe checkout session created'
        });

    } catch (error) {
        console.error(' Stripe session creation error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.verifyPayment = async (req, res) => {
    try {
        const { sessionId } = req.body;

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                message: 'Session ID is required'
            });
        }


        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (session.payment_status === 'paid') {
            // Verify session belongs to current user
            if (session.metadata.userId !== req.user._id.toString()) {
                return res.status(403).json({
                    success: false,
                    message: 'Payment session does not belong to current user'
                });
            }

            // Check if already upgraded
            if (req.user.plan === 'pro') {
                return res.json({
                    success: true,
                    message: 'User already has pro plan',
                    alreadyUpgraded: true
                });
            }

            // Upgrade user to pro
            await User.findByIdAndUpdate(req.user._id, {
                plan: 'pro',
                messagesTotalLimit: 20
            });


            res.json({
                success: true,
                message: 'Payment verified and account upgraded!',
                plan: 'pro',
                messagesTotalLimit: 20
            });

        } else {
            res.status(400).json({
                success: false,
                message: 'Payment was not completed successfully'
            });
        }

    } catch (error) {
        console.error('Payment verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Error verifying payment'
        });
    }
};