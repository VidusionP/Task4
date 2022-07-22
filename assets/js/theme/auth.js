import PageManager from './page-manager';
import stateCountry from './common/state-country';
import $ from 'jquery';
import nod from './common/nod';
import validation from './common/form-validation';
import forms from './common/models/forms';
import { classifyForm, Validators } from './common/form-utils';

export default class Auth extends PageManager {
    constructor() {
        super();
        this.formCreateSelector = 'form[data-create-account-form]';
    }

    registerLoginValidation($loginForm) {
        const loginModel = forms;

        this.loginValidator = nod({
            submit: '.login-form input[type="submit"]',
        });

        this.loginValidator.add([
            {
                selector: '.login-form input[name="login_email"]',
                validate: (cb, val) => {
                    const result = loginModel.email(val);

                    cb(result);
                },
                errorMessage: this.context.useValidEmail,
            },
            {
                selector: '.login-form input[name="login_pass"]',
                validate: (cb, val) => {
                    const result = loginModel.password(val);

                    cb(result);
                },
                errorMessage: this.context.enterPass,
            },
        ]);

        $loginForm.submit((event) => {
            this.loginValidator.performCheck();

            if (this.loginValidator.areAll('valid')) {
                return;
            }

            event.preventDefault();
        });
    }

    registerForgotPasswordValidation($forgotPasswordForm) {
        this.forgotPasswordValidator = nod({
            submit: '.forgot-password-form input[type="submit"]',
        });

        this.forgotPasswordValidator.add([
            {
                selector: '.forgot-password-form input[name="email"]',
                validate: (cb, val) => {
                    const result = forms.email(val);

                    cb(result);
                },
                errorMessage: this.context.useValidEmail,
            },
        ]);

        $forgotPasswordForm.submit((event) => {
            this.forgotPasswordValidator.performCheck();

            if (this.forgotPasswordValidator.areAll('valid')) {
                return;
            }

            event.preventDefault();
        });
    }

    registerNewPasswordValidation() {
        const newPasswordForm = '.new-password-form';
        const newPasswordValidator = nod({
            submit: $(`${newPasswordForm} input[type="submit"]`),
        });
        const passwordSelector = $(`${newPasswordForm} input[name="password"]`);
        const password2Selector = $(`${newPasswordForm} input[name="password_confirm"]`);

        Validators.setPasswordValidation(
            newPasswordValidator,
            passwordSelector,
            password2Selector,
            this.passwordRequirements,
        );
    }

    registerCreateAccountValidator($createAccountForm) {
        const validationModel = validation($createAccountForm);
        const createAccountValidator = nod({
            submit: `${this.formCreateSelector} input[type='submit']`,
        });
        const $stateElement = $('[data-field-type="State"]');
        const emailSelector = `${this.formCreateSelector} [data-field-type='EmailAddress']`;
        const $emailElement = $(emailSelector);
        const passwordSelector = `${this.formCreateSelector} [data-field-type='Password']`;
        const $passwordElement = $(passwordSelector);
        const password2Selector = `${this.formCreateSelector} [data-field-type='ConfirmPassword']`;
        const $password2Element = $(password2Selector);
        const firstNameSelector = `${this.formCreateSelector} [data-field-type='FirstName']`;
        const $firstNameElement = $(firstNameSelector);
        const lastNameSelector = `${this.formCreateSelector} [data-field-type='LastName']`;
        const $lastNameElement = $(lastNameSelector);
        const howFindSelector = `${this.formCreateSelector} [data-label='How did you find us?']`;
        const $howFindElement = $(howFindSelector);
        const lookingForSlector = `${this.formCreateSelector} [data-label='I am looking for?']`;
        const $lookingForElement = $(lookingForSlector);
        
        createAccountValidator.add(validationModel);

        // if ($stateElement) {
        //     let $last;

        //     // Requests the states for a country with AJAX
        //     stateCountry($stateElement, this.context, (err, field) => {
        //         if (err) {
        //             throw new Error(err);
        //         }

        //         const $field = $(field);

        //         if (createAccountValidator.getStatus($stateElement) !== 'undefined') {
        //             createAccountValidator.remove($stateElement);
        //         }

        //         if ($last) {
        //             createAccountValidator.remove($last);
        //         }

        //         if ($field.is('select')) {
        //             $last = field;
        //             Validators.setStateCountryValidation(createAccountValidator, field);
        //         } else {
        //             Validators.cleanUpStateValidation(field);
        //         }
        //     });
        // }

        if ($emailElement) {
            createAccountValidator.remove(emailSelector);
            Validators.setEmailValidation(createAccountValidator, emailSelector);
        }

        if ($passwordElement && $password2Element) {
            createAccountValidator.remove(passwordSelector);
            createAccountValidator.remove(password2Selector);
            Validators.setPasswordValidation(
                createAccountValidator,
                passwordSelector,
                password2Selector,
                this.passwordRequirements,
            );
        }

        $createAccountForm.submit((event) => {            
            createAccountValidator.performCheck();
            console.log($emailElement);
            console.log($emailElement.val());
            if (createAccountValidator.areAll('valid')) {
                event.preventDefault();
                let body = JSON.stringify({
                    "firstName": $firstNameElement.val(),
                    "lastName": $lastNameElement.val(),
                    "email": $emailElement.val(),
                    "password": $passwordElement.val(),
                    "customFields": [
                        {
                            "fieldId": $howFindElement.attr("id").split("_")[1],
                            "fieldValue": $howFindElement.find(":selected").index()-1
                        },
                        {
                            "fieldId": $lookingForElement.attr("id").split("_")[1],
                            "fieldValue": $lookingForElement.find(":selected").index()-1
                        },
                        {
                            "fieldId": "31",
                            "fieldValue": "Leave in backyard"
                        }
                    ]
                })                             

                fetch(`/api/storefront/customers`,{
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body
                })
                .then(r=>{
                    if (r.status==200) {
                        $('.login-form input[name="login_email"]').val($emailElement.val());
                        $('.login-form input[name="login_pass"]').val($passwordElement.val());
                        $('.login-form').trigger("submit");
                    } else {
                        fetch(`//shp-webserver-temp.glitch.me/bc-customer-exist?email=${$emailElement.val()}&store_id=999745060`)
                        .then(r=>r.json())
                        .then(r=>{
                            console.log(r);
                            if (r.exist) {
                                const $messageBox = $("[custom-create-account-error]");
                                $('p.alertBox-message', $messageBox).text(`The email address ${$emailElement.val()} is already in use. Please enter a different one.`);
                                $messageBox.show();
                            } else {
                                const $messageBox = $("[custom-create-account-error]");
                                $('p.alertBox-message', $messageBox).text(`We can not create an account for you. Please try again later or contact our customer support.`);
                                $messageBox.show();
                            }
                        })
                        .catch(e=>console.log(e));
                    }
                })            
                .catch(e=>console.log(e));
            } else {
                event.preventDefault();
            }            
        });
    }

    /**
     * Request is made in this function to the remote endpoint and pulls back the states for country.
     * @param next
     */
    loaded(next) {
        const $createAccountForm = classifyForm(this.formCreateSelector);
        const $loginForm = classifyForm('.login-form');
        const $forgotPasswordForm = classifyForm('.forgot-password-form');
        const $newPasswordForm = classifyForm('.new-password-form'); // reset password

        // Injected via auth.html
        this.passwordRequirements = this.context.passwordRequirements;

        if ($loginForm.length) {
            this.registerLoginValidation($loginForm);
        }

        if ($newPasswordForm.length) {
            this.registerNewPasswordValidation();
        }

        if ($forgotPasswordForm.length) {
            this.registerForgotPasswordValidation($forgotPasswordForm);
        }

        if ($createAccountForm.length) {
            this.registerCreateAccountValidator($createAccountForm);
        }

        next();
    }
}
