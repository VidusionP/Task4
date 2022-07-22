import $ from 'jquery';
import utils from '@bigcommerce/stencil-utils';
import 'foundation-sites/js/foundation/foundation';
import 'foundation-sites/js/foundation/foundation.reveal';
import ImageGallery from '../product/image-gallery';
import modalFactory from '../global/modal';
import _ from 'lodash';
import swal from 'sweetalert2';

export default class ProductDetails {
    constructor($scope, context, productAttributesData = {}) {
        this.$overlay = $('[data-cart-item-add] .loadingOverlay');
        this.$scope = $scope;
        this.context = context;
        this.imageGallery = new ImageGallery($('[data-image-gallery]', this.$scope));
        this.imageGallery.init();
        this.listenQuantityChange();
        this.initRadioAttributes();
        this.$hasSoldOut = false;
        this.$pSKUList = [];
        this.$pVariantList = [];
        this.$pModifierList=[];
        this.$pDeliveryList= null;
        this.$poSKUList = [];
        this.$pCurrent = null;
        this.$allureException = ['coco', 'rose', 'adele', 'angelina', 'jessica', 'selena', 'taylor', 'julia', 'nicole', 'gwyneth', 'ev7914', 'tl6814', 'ev5714', 'mo5514', 'mo7608', 'ev5512', 'ev5706', 'ev6810', 'eg6612', 'eh16', 'mh2206', 'sh5206', 'ep3608', 'mh2216', 'maya', 'noya'];        

        console.log($scope);
        const $form = $('form[data-cart-item-add]', $scope);
        const $productOptionsElement = $('[data-product-option-change]', $form);        
        const hasOptions = $productOptionsElement.html()?$productOptionsElement.html().trim().length:0;

        $productOptionsElement.change(event => {
            this.productOptionsChanged(event);
        });

        $form.submit(event => {
            // console.log(new FormData($form[0]));
            this.addProductToCart(event, $form[0]);
        });

        // Update product attributes. If we're in quick view and the product has options,
        // then also update the initial view in case items are oos
        if (_.isEmpty(productAttributesData) && hasOptions) {
            const $productId = $('[name="product_id"]', $form).val();

            utils.api.productAttributes.optionChange($productId, $form.serialize(), (err, response) => {
                const attributesData = response.data || {};

                this.updateProductAttributes(attributesData);
                this.updateView(attributesData);
                this.getDeliverList(attributesData);
            });
        } else {
            // this.updateProductAttributes(productAttributesData);
            this.initProductAttributes(productAttributesData);
            this.getDeliverList(productAttributesData);
            if (this.$hasSoldOut) {
                // $(".btn-book").show();
                $(".btn-book-more").show();
            }
        }

        $productOptionsElement.show();

        this.previewModal = modalFactory('#previewModal')[0];
    }

    /**
     * Since $productView can be dynamically inserted using render_with,
     * We have to retrieve the respective elements
     *
     * @param $scope
     */
    getViewModel($scope) {
        return {
            $priceWithTax: $('[data-product-price-with-tax]', $scope),
            $rrpWithTax: $('[data-product-rrp-with-tax]', $scope),
            $priceWithoutTax: $('[data-product-price-without-tax]', $scope),
            $rrpWithoutTax: $('[data-product-rrp-without-tax]', $scope),
            $weight: $('.productView-info [data-product-weight]', $scope),
            $increments: $('.form-field--increments :input', $scope),
            $addToCart: $('#form-action-addToCart', $scope),
            $wishlistVariation: $('[data-wishlist-add] [name="variation_id"]', $scope),
            stock: {
                $container: $('.form-field--stock', $scope),
                $input: $('[data-product-stock]', $scope),
            },
            $sku: $('[data-product-sku]'),
            $upc: $('[data-product-upc]'),
            quantity: {
                $text: $('.incrementTotal', $scope),
                $input: $('[name=qty\\[\\]]', $scope),
            },
        };
    }

    /**
     * Checks if the current window is being run inside an iframe
     * @returns {boolean}
     */
    isRunningInIframe() {
        try {
            return window.self !== window.top;
        } catch (e) {
            return true;
        }
    }

    /**
     *
     * Handle product options changes
     *
     */
    productOptionsChanged(event) {
        const $changedOption = $(event.target);
        const $form = $changedOption.parents('form');
        const productId = $('[name="product_id"]', $form).val();

        // Do not trigger an ajax request if it's a file or if the browser doesn't support FormData
        if ($changedOption.attr('type') === 'file' || window.FormData === undefined) {
            return;
        }

        utils.api.productAttributes.optionChange(productId, $form.serialize(), (err, response) => {
            const productAttributesData = response.data || {};

            this.updateProductAttributes(productAttributesData);
            this.updateView(productAttributesData);
            this.updateDeliverTime(productAttributesData);
        });
    }

    showProductImage(image) {
        if (_.isPlainObject(image)) {
            const zoomImageUrl = utils.tools.image.getSrc(
                image.data,
                this.context.themeSettings.zoom_size,
            );

            const mainImageUrl = utils.tools.image.getSrc(
                image.data,
                this.context.themeSettings.product_size,
            );

            this.imageGallery.setAlternateImage({
                mainImageUrl,
                zoomImageUrl,
            });
        } else {
            this.imageGallery.restoreImage();
        }
    }

    /**
     *
     * Handle action when the shopper clicks on + / - for quantity
     *
     */
    listenQuantityChange() {
        this.$scope.on('click', '[data-quantity-change] button', (event) => {
            event.preventDefault();
            const $target = $(event.currentTarget);
            const viewModel = this.getViewModel(this.$scope);
            const $input = viewModel.quantity.$input;
            const quantityMin = parseInt($input.data('quantity-min'), 10);
            const quantityMax = parseInt($input.data('quantity-max'), 10);

            let qty = parseInt($input.val(), 10);

            // If action is incrementing
            if ($target.data('action') === 'inc') {
                // If quantity max option is set
                if (quantityMax > 0) {
                    // Check quantity does not exceed max
                    if ((qty + 1) <= quantityMax) {
                        qty++;
                    }
                } else {
                    qty++;
                }
            } else if (qty > 1) {
                // If quantity min option is set
                if (quantityMin > 0) {
                    // Check quantity does not fall below min
                    if ((qty - 1) >= quantityMin) {
                        qty--;
                    }
                } else {
                    qty--;
                }
            }

            // update hidden input
            viewModel.quantity.$input.val(qty);
            // update text
            viewModel.quantity.$text.text(qty);

            if (this.$pCurrent) {
                this.updateDeliverTime(this.$pCurrent);
            }

        });
    }

    /**
     *
     * Add a product to cart
     *
     */
    addProductToCart(event, form) {
        const $addToCartBtn = $('#form-action-addToCart', $(event.target));
        const originalBtnVal = $addToCartBtn.val();
        const waitMessage = $addToCartBtn.data('waitMessage');

        // Do not do AJAX if browser doesn't support FormData
        if (window.FormData === undefined) {
            return;
        }

        // Prevent default
        event.preventDefault();

        $addToCartBtn
            .val(waitMessage)
            .prop('disabled', true);

        this.$overlay.show();

        // Add item to cart
        utils.api.cart.itemAdd(new FormData(form), (err, response) => {
            const errorMessage = err || response.data.error;

            $addToCartBtn
                .val(originalBtnVal)
                .prop('disabled', false);

            this.$overlay.hide();

            // Guard statement
            if (errorMessage) {
                // Strip the HTML from the error message
                const tmp = document.createElement('DIV');
                tmp.innerHTML = errorMessage;

                return swal({
                    text: tmp.textContent || tmp.innerText,
                    type: 'error',
                });
            }

            // Open preview modal and update content
            if (this.previewModal) {
                this.previewModal.open();

                this.updateCartContent(this.previewModal, response.data.cart_item.hash);
            } else {
                this.$overlay.show();
                // if no modal, redirect to the cart page
                this.redirectTo(response.data.cart_item.cart_url || this.context.urls.cart);
            }
        });
    }

    /**
     *
     * Custom Add a product to cart
     *
     */
    customAddProductToCart(sku) {
        
        console.log(sku);
        this.$overlay.show();

        // console.log(form);
        // console.log(typeof form);
        // let ff = new FormData(form);
        // for (let ee of ff.entries()) {
        //     console.log(ee);
        // }

        let v = this.$pVariantList.filter(vv=>vv.sku==sku);
        console.log(this.$pVariantList);
        console.log(v);
        if (v.length>0) {
            let form = new FormData();
            form.append("action", "add");
            form.append("product_id",v[0].product_id);
            for (let op of v[0].option_values) {
                form.append(`attribute[${op.option_id}]`,op.id);
            }
            if (this.$pModifierList.length>0) {
                for (let m of this.$pModifierList) {                    
                    form.append(`attribute[${m.id}]`,$(`#attribute_${m.id}`).val());
                }
            }
            form.append("qty[]",1);

            console.log(form.entries());
            // Add item to cart
            utils.api.cart.itemAdd(form, (err, response) => {
                const errorMessage = err || response.data.error;            

                this.$overlay.hide();

                // Guard statement
                if (errorMessage) {
                    // Strip the HTML from the error message
                    const tmp = document.createElement('DIV');
                    tmp.innerHTML = errorMessage;

                    return swal({
                        text: tmp.textContent || tmp.innerText,
                        type: 'error',
                    });
                }

                // Open preview modal and update content
                if (this.previewModal) {
                    this.previewModal.open();

                    this.updateCartContent(this.previewModal, response.data.cart_item.hash);
                } else {
                    this.$overlay.show();
                    // if no modal, redirect to the cart page
                    this.redirectTo(response.data.cart_item.cart_url || this.context.urls.cart);
                }
            });
        }        
    }

    /**
     * Get cart contents
     *
     * @param {String} cartItemHash
     * @param {Function} onComplete
     */
    getCartContent(cartItemHash, onComplete) {
        const options = {
            template: 'cart/preview',
            params: {
                suggest: cartItemHash,
            },
            config: {
                cart: {
                    suggestions: {
                        limit: 4,
                    },
                },
            },
        };

        utils.api.cart.getContent(options, onComplete);
    }

    /**
     * Redirect to url
     *
     * @param {String} url
     */
    redirectTo(url) {
        if (this.isRunningInIframe() && !window.iframeSdk) {
            window.top.location = url;
        } else {
            window.location = url;
        }
    }

    /**
     * Update cart content
     *
     * @param {Modal} modal
     * @param {String} cartItemHash
     * @param {Function} onComplete
     */
    updateCartContent(modal, cartItemHash, onComplete) {
        this.getCartContent(cartItemHash, (err, response) => {
            if (err) {
                return;
            }

            modal.updateContent(response);

            // Update cart counter
            const $body = $('body');
            const $cartQuantity = $('[data-cart-quantity]', modal.$content);
            const $cartCounter = $('.navUser-action .cart-count');
            const quantity = $cartQuantity.data('cart-quantity') || 0;

            $cartCounter.addClass('cart-count--positive');
            $body.trigger('cart-quantity-update', quantity);

            if (onComplete) {
                onComplete(response);
            }
        });
    }

    /**
     * Show an message box if a message is passed
     * Hide the box if the message is empty
     * @param  {String} message
     */
    showMessageBox(message) {
        const $messageBox = $('.productAttributes-message');

        if (message) {
            $('.alertBox-message', $messageBox).text(message);
            $messageBox.show();
        } else {
            $messageBox.hide();
        }
    }

    /**
     * Update the view of price, messages, SKU and stock options when a product option changes
     * @param  {Object} data Product attribute data
     */
    updatePriceView(viewModel, price) {
        if (price.with_tax) {
            viewModel.$priceWithTax.html(price.with_tax.formatted);
        }

        if (price.without_tax) {
            viewModel.$priceWithoutTax.html(price.without_tax.formatted);
        }

        if (price.rrp_with_tax) {
            viewModel.$rrpWithTax.html(price.rrp_with_tax.formatted);
        }

        if (price.rrp_without_tax) {
            viewModel.$rrpWithoutTax.html(price.rrp_without_tax.formatted);
        }
    }

    /**
     * Update the view of price, messages, SKU and stock options when a product option changes
     * @param  {Object} data Product attribute data
     */
    updateView(data) {
        const viewModel = this.getViewModel(this.$scope);

        this.showMessageBox(data.stock_message || data.purchasing_message);

        if (_.isObject(data.price)) {
            this.updatePriceView(viewModel, data.price);
        }

        if (_.isObject(data.weight)) {
            viewModel.$weight.html(data.weight.formatted);
        }

        // Set variation_id if it exists for adding to wishlist
        if (data.variantId) {
            viewModel.$wishlistVariation.val(data.variantId);
        }

        // If SKU is available
        if (data.sku) {
            viewModel.$sku.text(data.sku);
        }

        // If UPC is available
        if (data.upc) {
            viewModel.$upc.text(data.upc);
        }

        // if stock view is on (CP settings)
        if (viewModel.stock.$container.length && _.isNumber(data.stock)) {
            // if the stock container is hidden, show
            viewModel.stock.$container.removeClass('u-hiddenVisually');

            // viewModel.stock.$input.text(data.stock);
        }

        if (!data.purchasable || !data.instock) {
            viewModel.$addToCart.prop('disabled', true);
            viewModel.$increments.prop('disabled', true);
        } else {
            viewModel.$addToCart.prop('disabled', false);
            viewModel.$increments.prop('disabled', false);
        }
    }
    getIncomingTime(avai, inItems, buffer, qty=1, check=false) {
        let i = -1;
        let qPO = avai-buffer;        
        while (qPO<qty && i<inItems.length-1) {
            i++;
            qPO+=inItems[i]["Incoming Quantity"];            
        }
        if (qPO>=qty && i<inItems.length) {
            return {
                qPO,
                i
            }
        } else {
            return null;
        }
    }
    getModifiers(){
        const $form = $('form[data-cart-item-add]', this.$scope);
        const $productId = $('[name="product_id"]', $form).val();
        fetch(`https://shp-webserver-temp.glitch.me/get-product-modifiers?product_id=${$productId}&store_id=999745060`)
        .then(r=>r.json())
        .then(r=>{
            if (r.data) {
                this.$pModifierList = r.data;
                this.getVariantList();
            }
        })
    }
    initEarliestSelection(data) {
        $(".delivery-wrap").append(`<div class="del-content-wrap del-content-hidden"></div>`);
        let attrs=[], lbb = [], lb=[];        
        for (let op of this.$pVariantList[0].option_values) {
            attrs.push(op.option_id);
            lbb.push(op.option_display_name);
        }
        let ops=`<div class="item">
                <select dlvr-selection attributes="${attrs.join(",")}">                    
                </select>
            </div>`;
        // if (this.$pVariantList[0].option_values.length>1) {
        //     $(".del-content-wrap").css({display: "grid"});
        // }
        $(".del-content-wrap").append(ops);
        console.log(this.$pVariantList);
        // for (let s of this.$pVariantList) {
        //     if ($(`select[dlvr-selection]`).find(`option[value="${s.sku.toUpperCase()}"]`).length==0) {
        //         attrs=[];
        //         lb = [];
        //         for (let op of s.option_values) {
        //             attrs.push(`attribute${op.option_id}=${op.id}`);
        //             if (op.label.toLowerCase().includes("solid")==false) {
        //                 lb.push(op.label);
        //             }
        //         }
        //         $(`select[dlvr-selection]`).append(`<option ${attrs.join(" ")} value="${s.sku.toUpperCase()}">${lb.join(" with ")}</option>`);
        //     }
        // }
        for (let s of this.$pSKUList) {
            let idx = this.$pVariantList.findIndex(v=>v.sku.toUpperCase()==s.SKU.toUpperCase());
            if (idx>=0) {
                let ss = this.$pVariantList[idx];
                if ($(`select[dlvr-selection]`).find(`option[value="${ss.sku.toUpperCase()}"]`).length==0) {
                    attrs=[];
                    lb = [];
                    for (let op of ss.option_values) {
                        attrs.push(`attribute${op.option_id}=${op.id}`);
                        if (op.label.toLowerCase().includes("solid")==false) {
                            lb.push(op.label);
                        }
                    }
                    $(`select[dlvr-selection]`).append(`<option ${attrs.join(" ")} value="${ss.sku.toUpperCase()}">${lb.join(" with ")}</option>`);
                }
            }
        }
        // var options = $("select[dlvr-selection] option");
        // options.detach().sort(function(a,b) {
        //     var at = $(a).text();
        //     var bt = $(b).text();         
        //     return (at > bt)?1:((at < bt)?-1:0);
        // });
        // options.appendTo("select[dlvr-selection]");
        $("select[dlvr-selection]").prepend(`<option disabled selected>${lbb.join(" with ")}</option>`);        
        $("select[dlvr-selection]").change((event)=>{            
            this.embeddedEalierOption(event.currentTarget);
        });
        $(".del-content-wrap").after(`<button action="del-reset">Reset</button>`)  ;
        $("button[action=del-reset]").click((event)=>{            
            this.embeddedEalierOption(null);
        });                 
        if (this.$allureException.includes(this.$pSKUList[0]["Part Number"].toLowerCase())==false) {
            this.setEarliestTimeNoAllure();
        } else {
            this.setEarliestTimeAllure();
        }
    }
    getVariantList() {
        const $form = $('form[data-cart-item-add]', this.$scope);
        const $productId = $('[name="product_id"]', $form).val();
        fetch(`https://shp-webserver-temp.glitch.me/get-bc-variant-by-product?product_id=${$productId}&store_id=999745060`)
        .then(r=>r.json())
        .then(r=>{
            if (r.data){
                if (r.data.length>0) {
                    this.$pVariantList = r.data;
                    this.initEarliestSelection();
                }
            }
        })
        .catch(e=>console.log(e));        
    }
    setEarliestTimeAllure() {
        if (this.$pSKUList.length>0) {
            let dlTBody = "";
            let nowBtn = false;
            let transferBtn = false;
            let transitBtn = false;                    
            let virtualBtn = [];
            let virtualSBtn = [];
            let deliveryList = {};
            function monthDiff(d1, d2) {
                var months;
                months = (d2.getFullYear() - d1.getFullYear()) * 12;
                months -= d1.getMonth();
                months += d2.getMonth();
                return months <= 0 ? 0 : months;
            }
            function isOdd(num) {
                return num%2;
            }
            for (let td of this.$pSKUList) {
                let qtyNote = "";            
                if (Number(td["Available Quantity"])>0) {
                    if (Number(td["Available Quantity"]) != Number(td["Total On Hand"])) {
                        if (transferBtn == false) {
                            transferBtn = true;
                            deliveryList["transfer"]=[];
                        }
                        deliveryList["transfer"].push({
                            sku: td.SKU.toUpperCase(),
                            stock: {
                                all: Number(td["Available Quantity"])
                            },
                            options:[]
                        });
                        let vIdx = this.$pVariantList.findIndex(vv=>vv.sku.toUpperCase()==td.SKU.toUpperCase());
                        if (vIdx>=0) {
                            for (let vv of this.$pVariantList[vIdx].option_values) {
                                deliveryList["transfer"][deliveryList["transfer"].length-1].options.push({
                                    option_id: vv.option_id,
                                    id: vv.id
                                })
                            }
                        }
                    } else {
                        if (td["WH1"]) {
                            if (nowBtn == false) {
                                nowBtn = true;
                                deliveryList["now"]=[];
                            }
                            deliveryList["now"].push({
                                sku: td.SKU.toUpperCase(),
                                stock:{
                                    ca: Number(td["WH1"]),
                                    us: Number(td["2"])
                                },
                                options:[]
                            });
                            let vIdx = this.$pVariantList.findIndex(vv=>vv.sku.toUpperCase()==td.SKU.toUpperCase());
                            if (vIdx>=0) {
                                for (let vv of this.$pVariantList[vIdx].option_values) {
                                    deliveryList["now"][deliveryList["now"].length-1].options.push({
                                        option_id: vv.option_id,
                                        id: vv.id
                                    })
                                }
                            }
                        } else {
                            if (transferBtn == false) {
                                transferBtn = true;
                                deliveryList["transfer"]=[];
                            }
                            deliveryList["transfer"].push({
                                sku: td.SKU.toUpperCase(),
                                stock: {
                                    us: Number(td["2"]),
                                    ca: Number(td["WH1"])
                                },
                                options:[]
                            });
                            let vIdx = this.$pVariantList.findIndex(vv=>vv.sku.toUpperCase()==td.SKU.toUpperCase());
                            if (vIdx>=0) {
                                for (let vv of this.$pVariantList[vIdx].option_values) {
                                    deliveryList["transfer"][deliveryList["transfer"].length-1].options.push({
                                        option_id: vv.option_id,
                                        id: vv.id
                                    })
                                }
                            }
                        }
                    }                                                    
                } else if (td["Virtual Location"]) {      
                    if (td["Lock Status"]!="Locked for processing" && (Number(td["Unlocked for sale quantity"])+Number(td["Available Quantity"]))>0) {
                        if (transitBtn == false) {
                            transitBtn = true;
                            deliveryList["transit"]=[];
                        }
                        deliveryList["transit"].push({
                            sku: td.SKU.toUpperCase(),
                            stock: {
                                all: Number(td["Unlocked for sale quantity"])+Number(td["Available Quantity"])
                            },
                            options: []
                        });
                        let vIdx = this.$pVariantList.findIndex(vv=>vv.sku.toUpperCase()==td.SKU.toUpperCase());
                        if (vIdx>=0) {
                            for (let vv of this.$pVariantList[vIdx].option_values) {
                                deliveryList["transit"][deliveryList["transit"].length-1].options.push({
                                    option_id: vv.option_id,
                                    id: vv.id
                                })
                            }
                        }
                    } else if (Number(td["Quantity Incoming"])+Number(td["Available Quantity"])-Number(td["Total Request Quantity"])-2>0) {                         
                        let inItems = this.$poSKUList.filter(p=>p.SKU.toUpperCase()==td["SKU"].toUpperCase());
                        if (inItems.length>0) {
                            let cPO = this.getIncomingTime(Number(td["Available Quantity"]), inItems, Number(td["Total Request Quantity"])+2);                                    
                            if (cPO) {
                                let inItem = inItems[cPO.i];
                                let today = new Date();
                                let arrival = new Date(inItem["Arrival Due Date"]);
                                let mDiff = monthDiff(new Date(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()), new Date(arrival.getUTCFullYear(), arrival.getUTCMonth(), arrival.getUTCDate()));
                                if (mDiff<=0) {                                            
                                    let vIdx = virtualBtn.findIndex(v=>v.name=="4M");
                                    if (vIdx==-1) {
                                        virtualBtn.push({
                                            name: "4M",
                                            duration: 4,
                                            section: "production"
                                        });
                                        deliveryList["4m"]=[];
                                    } else if (virtualBtn[vIdx].section=="preorder") {
                                        virtualBtn[vIdx].section="combination";
                                    }
                                    deliveryList["4m"].push({
                                        sku: td.SKU.toUpperCase(),
                                        stock: {
                                            all: cPO.qPO
                                        },
                                        options: []
                                    });
                                    vIdx = this.$pVariantList.findIndex(vv=>vv.sku.toUpperCase()==td.SKU.toUpperCase());
                                    if (vIdx>=0) {
                                        for (let vv of this.$pVariantList[vIdx].option_values) {
                                            deliveryList["4m"][deliveryList["4m"].length-1].options.push({
                                                option_id: vv.option_id,
                                                id: vv.id
                                            })
                                        }
                                    }
                                } else {
                                    mDiff = Number(mDiff) + 2;                                
                                    if (isOdd(mDiff) && mDiff<7) {
                                        mDiff+=1;
                                    }
                                    let vIdx = virtualBtn.findIndex(v=>v.name==`${mDiff}M`);
                                    if (vIdx==-1) {
                                        virtualBtn.push({
                                            name: `${mDiff}M`,
                                            duration: mDiff,
                                            section: "production"
                                        });
                                        deliveryList[`${mDiff}m`]=[];
                                    } else if (virtualBtn[vIdx].section=="preorder") {
                                        virtualBtn[vIdx].section="combination";
                                    }
                                    deliveryList[`${mDiff}m`].push({
                                        sku: td.SKU.toUpperCase(),
                                        stock: {
                                            all: cPO.qPO
                                        },
                                        options:[]
                                    });
                                    vIdx = this.$pVariantList.findIndex(vv=>vv.sku.toUpperCase()==td.SKU.toUpperCase());
                                    if (vIdx>=0) {
                                        for (let vv of this.$pVariantList[vIdx].option_values) {
                                            deliveryList[`${mDiff}m`][deliveryList[`${mDiff}m`].length-1].options.push({
                                                option_id: vv.option_id,
                                                id: vv.id
                                            })
                                        }
                                    }
                                }
                            }                                    
                        }                                                                
                    } else {
                        if (td["Virtual Location"].includes("_")) {
                            virtualSBtn.push(td["Virtual Location"]);
                            if (deliveryList[td["Virtual Location"].toLowerCase()]) {
                                deliveryList[td["Virtual Location"].toLowerCase()].push({
                                    sku: td.SKU.toUpperCase(),
                                    stock: {
                                        all: Number(td["Virtual Quantity"])+Number(td["Available Quantity"])
                                    },
                                    options:[]
                                });
                                let vIdx = this.$pVariantList.findIndex(vv=>vv.sku.toUpperCase()==td.SKU.toUpperCase());
                                if (vIdx>=0) {
                                    for (let vv of this.$pVariantList[vIdx].option_values) {
                                        deliveryList[td["Virtual Location"].toLowerCase()][deliveryList[td["Virtual Location"].toLowerCase].length-1].options.push({
                                            option_id: vv.option_id,
                                            id: vv.id
                                        })
                                    }
                                }
                            } else {
                                deliveryList[td["Virtual Location"].toLowerCase()]=[{
                                    sku: td.SKU.toUpperCase(),
                                    stock: {
                                        all: Number(td["Virtual Quantity"])+Number(td["Available Quantity"])
                                    },
                                    options:[]
                                }];
                                let vIdx = this.$pVariantList.findIndex(vv=>vv.sku.toUpperCase()==td.SKU.toUpperCase());
                                if (vIdx>=0) {
                                    for (let vv of this.$pVariantList[vIdx].option_values) {
                                        deliveryList[td["Virtual Location"].toLowerCase()][deliveryList[td["Virtual Location"].toLowerCase()].length-1].options.push({
                                            option_id: vv.option_id,
                                            id: vv.id
                                        })
                                    }
                                }
                            }  
                        } else {
                            let m = td["Virtual Location"][0];
                            if (isOdd(Number(m)) && Number(m)<7) {
                                m=Number(m)+1;
                            }
                            let duration = m;
                            m = `${m}M`;
                            let vIdx = virtualBtn.findIndex(v=>v.name==m);
                            if (vIdx==-1) {
                                virtualBtn.push({
                                    name: m,
                                    duration,
                                    section: "preorder"
                                });
                                deliveryList[m.toLowerCase()]=[];
                            } else if (virtualBtn[vIdx].section=="production") {
                                virtualBtn[vIdx].section="combination";
                            }
                            deliveryList[m.toLowerCase()].push({
                                sku: td.SKU.toUpperCase(),
                                stock: {
                                    all: Number(td["Virtual Quantity"])+Number(td["Available Quantity"])
                                },
                                options:[]
                            });
                            vIdx = this.$pVariantList.findIndex(vv=>vv.sku.toUpperCase()==td.SKU.toUpperCase());
                            if (vIdx>=0) {
                                for (let vv of this.$pVariantList[vIdx].option_values) {
                                    deliveryList[m.toLowerCase()][deliveryList[m.toLowerCase()].length-1].options.push({
                                        option_id: vv.option_id,
                                        id: vv.id
                                    })
                                }
                            }
                        }
                    }                            
                }
            }
            this.$pDeliveryList = deliveryList;            
            let btnWrap = "";
            let selectWrap = "<select>";
            if (nowBtn) {
                btnWrap+=`<input type="radio" id="del-time-now" value="now" name="delOption" class="del-input" data-desp="These units are in stock and can be shipped out as soon as possible."><label for="del-time-now" class="del-label">1 day</label>`;
                selectWrap+=`<option value="now" data-desp="These units are in stock and can be shipped out as soon as possible.">1 day</option>`;
            }
            if (transferBtn) {
                btnWrap+=`<input type="radio" id="del-time-transfer" value="transfer" name="delOption" class="del-input" data-desp="These units are in stock and can be shipped out as soon as possible."><label for="del-time-transfer" class="del-label">2-4 days</label>`;
                selectWrap+=`<option value="transfer" data-desp="These units are in stock and can be shipped out as soon as possible.">2-4 days</option>`;
            }
            if (transitBtn) {
                btnWrap+=`<input type="radio" id="del-time-transit" value="transit" name="delOption" class="del-input" data-desp="These units are in transit to our warehouses and can be shipped out in a few days."><label for="del-time-transit" class="del-label">5-7 days</label>`;
                selectWrap+=`<option value="transit" data-desp="These units are in transit to our warehouses and can be shipped out in a few days.">5-7 days</option>`;
            }
            console.log(virtualBtn);
            if (virtualBtn.length>0) {
                virtualBtn.sort((a,b)=> (Number(a.duration)>Number(b.duration))?1:((Number(b.duration)>Number(a.duration))?-1:0));
                console.log(virtualBtn);
                for (let v of virtualBtn) {
                    // let lb = v[0]>1?v.replace("M"," months").replace("_","-"):v.replace("M"," month").replace("_","-");
                    let lb = v.duration<7?(Number(v.duration)-1)+"-"+v.name.replace("M"," months"):v.name.replace("M"," months");
                    let desp = v.section=="production"?"These units are still in production. Once they are complete, they will be in transit to our warehouses ready to be shipped out.":(v.section=="preorder"?"These units are not in production and will start once an order is placed.":"These units are either in production or yet to start production. However, they are expected to be ship out in the same timeframe.");
                    btnWrap+=`<input type="radio" id="del-time-virtual-${v.name}" value="${v.name.toLowerCase()}" name="delOption" class="del-input" data-desp="${desp}"><label for="del-time-virtual-${v.name}" class="del-label">${lb}</label>`;
                    selectWrap+=`<option value="${v.name.toLowerCase()}" data-desp="${desp}">${lb}</option>`;
                }
            }
            if (virtualSBtn.length>0) {
                for (let v of virtualSBtn) {                                
                    let lb = v.replace("M"," months").replace("_","-");
                    let desp = "These units are not in production and will start once an order is placed.";
                    btnWrap+=`<input type="radio" id="del-time-virtual-${v}" value="${v.toLowerCase()}" name="delOption" class="del-input" data-desp="${desp}"><label for="del-time-virtual-${v}" class="del-label">${lb}</label>`;
                    selectWrap+=`<option value="${v.toLowerCase()}" data-desp="${desp}">${lb}</option>`;
                }
            }
            selectWrap+="</select>";     
            // console.log(btnWrap);               
            // $(".delivery-wrap").append(`<div class="del-btn-wrap">${btnWrap}</div><div class="del-select-wrap">${selectWrap}</div><div class="del-content-wrap del-content-hidden">${dlTBody}</div>`).show();
            $(".del-content-wrap").before(`<div class="del-btn-wrap">${btnWrap}</div><div class="del-select-wrap"><span>Earliest Ship Out Time:</span>${selectWrap}</div>`);        
            $("input[type=radio][name=delOption]").change((event) => {  
                console.log("input radio");
                this.embeddedEalierSection(event.currentTarget.value);
                $(`.del-select-wrap select option[value=${event.currentTarget.value}]`).prop("selected",true);
                // $(".del-item-wrap").hide();
                // let val = $(this).val();                                                
                // $(".del-item-wrap").filter(function(){                                                                                        
                //     return Number(this.getAttribute(`data-qty-${val}`))>0;
                // }).show();
            });
            $(".del-select-wrap select").change((event) => {  
                console.log("select option");
                this.embeddedEalierSection(event.currentTarget.value);
                $(`input[type=radio][name=delOption][value=${event.currentTarget.value}]`).prop("checked",true);
            });
            $("input[type=radio][name=delOption]").eq(0).prop("checked", true).trigger("change");
            if ($(window).width()>700) {
                $("[shipping-time-label] span").html(`Try quick check ${this.$pSKUList[0]["Part Number"]} all available options by delivery time`);
                $("[shipping-time-label] img").attr("src","/content/images/common/thunder.svg").removeClass("loading");
            } else {
                if ($(window).width()>550) {
                    $("[shipping-time-label] span").html(`Try quick check<br/> <span style="margin-left: 20px;">${this.$pSKUList[0]["Part Number"]} all available options by delivery time</span>`);
                    $(".custom-attribute-wrap[black] .link-inventory").css({"margin-left":"20px"});
                } else {
                    $("[shipping-time-label] span").html(`Try quick check<br/> <span>${this.$pSKUList[0]["Part Number"]} all available options by delivery time</span>`);
                }
                $("[shipping-time-label] img").attr("src","/content/images/common/thunder.svg").removeClass("loading");
                $(".custom-attribute-wrap[black] span").after(`<br/>`);                
            }
        }       
        $(".delivery-wrap").show(); 
    }    
    embeddedEalierSection(val) {
        let sc = this.$pDeliveryList[val];   
        console.log("sc");
        console.log(sc);
        // $("select[dlvr-selection] option").prop("disabled", true);
        $("select[dlvr-selection] option").hide();
        $("select[dlvr-selection] option:first-child").show();
        if (sc) {
            if (sc.length>0) {
                for (let d of sc) {
                    // $(`select[dlvr-selection] option[value="${d.sku.toUpperCase()}"]`).prop("disabled", false);
                    $(`select[dlvr-selection] option[value="${d.sku.toUpperCase()}"]`).show();
                }
            }
        }        
        this.embeddedEalierOption(null);
    }    
    embeddedEalierOption(op) {        
        if (op) {
            let attrs = $(op).attr("attributes");
            attrs = attrs.split(",");
            for (let att of attrs) {
                $(`#attribute_${att}`).val($(op).find(":selected").attr(`attribute${att}`));
            }
            this.updateDeliverTime({sku:$(op).val()});
        } else {
            let attrs = $("select[dlvr-selection]").attr("attributes");
            attrs = attrs.split(",");
            attrs.forEach(sl=>{
                $("select[dlvr-selection]").val($("select[dlvr-selection] option:first").val());
                $(`#attribute_${sl}`).val($(`#attribute_${sl} option:first`).val());
                $(`#attribute_${sl}`).trigger("change");
            });
        }
    }
    setEarliestTimeNoAllure() {
        if (this.$pSKUList.length>0) {
            let dlTBody = "";
            let nowBtn = false;
            let transferBtn = false;
            let transitBtn = false;                    
            let virtualBtn = [];
            let virtualSBtn = [];
            let deliveryList = {};
            function monthDiff(d1, d2) {
                var months;
                months = (d2.getFullYear() - d1.getFullYear()) * 12;
                months -= d1.getMonth();
                months += d2.getMonth();
                return months <= 0 ? 0 : months;
            }
            function isOdd(num) {
                return num%2;
            }
            for (let td of this.$pSKUList) {            
                if (Number(td["Available Quantity"])>0) {
                    if (Number(td["Available Quantity"]) != Number(td["Total On Hand"])) {
                        if (transferBtn == false) {
                            transferBtn = true;
                            deliveryList["transfer"]=[];
                        }                    
                        deliveryList["transfer"].push({
                            sku: td.SKU.toUpperCase(),                            
                            stock: {
                                all: Number(td["Available Quantity"])
                            },
                            options:[]                            
                        });
                        let vIdx = this.$pVariantList.findIndex(vv=>vv.sku.toUpperCase()==td.SKU.toUpperCase());
                        if (vIdx>=0) {
                            for (let vv of this.$pVariantList[vIdx].option_values) {
                                deliveryList["transfer"][deliveryList["transfer"].length-1].options.push({
                                    option_id: vv.option_id,
                                    id: vv.id
                                })
                            }
                        }
                    } else {
                        if (td["WH1"]) {
                            if (nowBtn == false) {
                                nowBtn = true;   
                                deliveryList["now"]=[];
                            }
                            deliveryList["now"].push({
                                sku: td.SKU.toUpperCase(),
                                stock:{
                                    ca: Number(td["WH1"]),
                                    us: Number(td["2"])
                                },
                                options:[]                                
                            });
                            let vIdx = this.$pVariantList.findIndex(vv=>vv.sku.toUpperCase()==td.SKU.toUpperCase());
                            if (vIdx>=0) {
                                for (let vv of this.$pVariantList[vIdx].option_values) {
                                    deliveryList["now"][deliveryList["now"].length-1].options.push({
                                        option_id: vv.option_id,
                                        id: vv.id
                                    })
                                }
                            }
                        } else {
                            if (transferBtn == false) {
                                transferBtn = true;
                                deliveryList["transfer"]=[];
                            }
                            deliveryList["transfer"].push({
                                sku: td.SKU.toUpperCase(),
                                stock: {
                                    us: Number(td["2"]),
                                    ca: Number(td["WH1"])
                                },
                                options:[]                                
                            });
                            let vIdx = this.$pVariantList.findIndex(vv=>vv.sku.toUpperCase()==td.SKU.toUpperCase());
                            if (vIdx>=0) {
                                for (let vv of this.$pVariantList[vIdx].option_values) {
                                    deliveryList["transfer"][deliveryList["transfer"].length-1].options.push({
                                        option_id: vv.option_id,
                                        id: vv.id
                                    })
                                }
                            }
                        }
                    }                                                    
                } else if (td["Virtual Location"]) {                                
                    if (td["Lock Status"]!="Locked for processing" && (Number(td["Unlocked for sale quantity"])+Number(td["Available Quantity"]))>0) {
                        if (transitBtn == false) {
                            transitBtn = true;
                            deliveryList["transit"]=[];
                        }
                        deliveryList["transit"].push({
                            sku: td.SKU.toUpperCase(),
                            stock: {
                                all: Number(td["Unlocked for sale quantity"])+Number(td["Available Quantity"])
                            },
                            options: []                            
                        });
                        let vIdx = this.$pVariantList.findIndex(vv=>vv.sku.toUpperCase()==td.SKU.toUpperCase());
                        if (vIdx>=0) {
                            for (let vv of this.$pVariantList[vIdx].option_values) {
                                deliveryList["transit"][deliveryList["transit"].length-1].options.push({
                                    option_id: vv.option_id,
                                    id: vv.id
                                })
                            }
                        }
                    } else if (Number(td["Quantity Incoming"])+Number(td["Available Quantity"])-Number(td["Total Request Quantity"])-2>0) {                                    
                        let inItems = this.$poSKUList.filter(p=>p.SKU.toUpperCase()==td["SKU"].toUpperCase());
                        if (inItems.length>0) {
                            let cPO = this.getIncomingTime(Number(td["Available Quantity"]), inItems, Number(td["Total Request Quantity"])+2);                                    
                            if (cPO) {
                                let inItem = inItems[cPO.i];
                                let today = new Date();
                                let arrival = new Date(inItem["Arrival Due Date"]);
                                let mDiff = monthDiff(new Date(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()), new Date(arrival.getUTCFullYear(), arrival.getUTCMonth(), arrival.getUTCDate()));
                                if (mDiff<=0) {                                            
                                    let vIdx = virtualBtn.findIndex(v=>v.name=="2M");
                                    if (vIdx==-1) {
                                        virtualBtn.push({
                                            name: "2M",
                                            section: "production"
                                        });
                                        deliveryList["2m"]=[];
                                    } else if (virtualBtn[vIdx].section=="preorder") {
                                        virtualBtn[vIdx].section="combination";
                                    }
                                    deliveryList["2m"].push({
                                        sku: td.SKU.toUpperCase(),
                                        stock: {
                                            all: cPO.qPO
                                        },
                                        options: []                                        
                                    });
                                    vIdx = this.$pVariantList.findIndex(vv=>vv.sku.toUpperCase()==td.SKU.toUpperCase());
                                    if (vIdx>=0) {
                                        for (let vv of this.$pVariantList[vIdx].option_values) {
                                            deliveryList["2m"][deliveryList["2m"].length-1].options.push({
                                                option_id: vv.option_id,
                                                id: vv.id
                                            })
                                        }
                                    }
                                } else {
                                    if (isOdd(mDiff) && mDiff<7) {
                                        mDiff+=1;
                                    }
                                    let vIdx = virtualBtn.findIndex(v=>v.name==`${mDiff}M`);
                                    if (vIdx==-1) {
                                        virtualBtn.push({
                                            name: `${mDiff}M`,
                                            section: "production"
                                        });
                                        deliveryList[`${mDiff}m`]=[];
                                    } else if (virtualBtn[vIdx].section=="preorder") {
                                        virtualBtn[vIdx].section="combination";
                                    }
                                    deliveryList[`${mDiff}m`].push({
                                        sku: td.SKU.toUpperCase(),
                                        stock: {
                                            all: cPO.qPO
                                        },
                                        options:[]                                        
                                    });
                                    vIdx = this.$pVariantList.findIndex(vv=>vv.sku.toUpperCase()==td.SKU.toUpperCase());
                                    if (vIdx>=0) {
                                        for (let vv of this.$pVariantList[vIdx].option_values) {
                                            deliveryList[`${mDiff}m`][deliveryList[`${mDiff}m`].length-1].options.push({
                                                option_id: vv.option_id,
                                                id: vv.id
                                            })
                                        }
                                    }
                                }
                            }                                    
                        }                                                                
                    } else {
                        if (td["Virtual Location"].includes("_")) {
                            virtualSBtn.push(td["Virtual Location"]);
                            if (deliveryList[td["Virtual Location"].toLowerCase()]) {
                                deliveryList[td["Virtual Location"].toLowerCase()].push({
                                    sku: td.SKU.toUpperCase(),
                                    stock: {
                                        all: Number(td["Virtual Quantity"])+Number(td["Available Quantity"])
                                    },
                                    options:[]                                    
                                });
                                let vIdx = this.$pVariantList.findIndex(vv=>vv.sku.toUpperCase()==td.SKU.toUpperCase());
                                if (vIdx>=0) {
                                    for (let vv of this.$pVariantList[vIdx].option_values) {
                                        deliveryList[td["Virtual Location"].toLowerCase()][deliveryList[td["Virtual Location"].toLowerCase].length-1].options.push({
                                            option_id: vv.option_id,
                                            id: vv.id
                                        })
                                    }
                                }
                            } else {
                                deliveryList[td["Virtual Location"].toLowerCase()]=[{
                                    sku: td.SKU.toUpperCase(),
                                    stock: {
                                        all: Number(td["Virtual Quantity"])+Number(td["Available Quantity"])
                                    },
                                    options:[]                                    
                                }];
                                let vIdx = this.$pVariantList.findIndex(vv=>vv.sku.toUpperCase()==td.SKU.toUpperCase());
                                if (vIdx>=0) {
                                    for (let vv of this.$pVariantList[vIdx].option_values) {
                                        deliveryList[td["Virtual Location"].toLowerCase()][deliveryList[td["Virtual Location"].toLowerCase()].length-1].options.push({
                                            option_id: vv.option_id,
                                            id: vv.id
                                        })
                                    }
                                }
                            }  
                        } else {
                            let m = td["Virtual Location"][0];
                            if (isOdd(Number(m)) && Number(m)<7) {
                                m=Number(m)+1;
                            }
                            m = `${m}M`;
                            let vIdx = virtualBtn.findIndex(v=>v.name==m);
                            if (vIdx==-1) {
                                virtualBtn.push({
                                    name: m,
                                    section: "preorder"
                                });
                                deliveryList[m.toLowerCase()]=[];
                            } else if (virtualBtn[vIdx].section=="production") {
                                virtualBtn[vIdx].section="combination";
                            }
                            deliveryList[m.toLowerCase()].push({
                                sku: td.SKU.toUpperCase(),
                                stock: {
                                    all: Number(td["Virtual Quantity"])+Number(td["Available Quantity"])
                                },
                                options:[]                                
                            });
                            vIdx = this.$pVariantList.findIndex(vv=>vv.sku.toUpperCase()==td.SKU.toUpperCase());
                            if (vIdx>=0) {
                                for (let vv of this.$pVariantList[vIdx].option_values) {
                                    deliveryList[m.toLowerCase()][deliveryList[m.toLowerCase()].length-1].options.push({
                                        option_id: vv.option_id,
                                        id: vv.id
                                    })
                                }
                            }
                        }                                    
                    }                            
                }
            }
            this.$pDeliveryList = deliveryList;            
            let btnWrap = "";
            let selectWrap = "<select>";
            if (nowBtn) {
                btnWrap+=`<input type="radio" id="del-time-now" value="now" name="delOption" class="del-input" data-desp="These units are in stock and can be shipped out as soon as possible."><label for="del-time-now" class="del-label">1 day</label>`;
                selectWrap+=`<option value="now" data-desp="These units are in stock and can be shipped out as soon as possible.">1 day</option>`;
            }
            if (transferBtn) {
                btnWrap+=`<input type="radio" id="del-time-transfer" value="transfer" name="delOption" class="del-input" data-desp="These units are in stock and can be shipped out as soon as possible."><label for="del-time-transfer" class="del-label">2-4 days</label>`;
                selectWrap+=`<option value="transfer" data-desp="These units are in stock and can be shipped out as soon as possible.">2-4 days</option>`;
            }
            if (transitBtn) {
                btnWrap+=`<input type="radio" id="del-time-transit" value="transit" name="delOption" class="del-input" data-desp="These units are in transit to our warehouses and can be shipped out in a few days."><label for="del-time-transit" class="del-label">5-7 days</label>`;
                selectWrap+=`<option value="transit" data-desp="These units are in transit to our warehouses and can be shipped out in a few days.">5-7 days</option>`;
            }
            // console.log(virtualBtn);
            if (virtualBtn.length>0) {
                virtualBtn.sort((a,b)=> (a.name>b.name)?1:((b.name>a.name)?-1:0));
                // console.log(virtualBtn);
                for (let v of virtualBtn) {
                    // let lb = v[0]>1?v.replace("M"," months").replace("_","-"):v.replace("M"," month").replace("_","-");
                    let lb = v.name[0]<7?(Number(v.name[0])-1)+"-"+v.name.replace("M"," months").replace("_","-"):v.name.replace("M"," months").replace("_","-");
                    let desp = v.section=="production"?"These units are still in production. Once they are complete, they will be in transit to our warehouses ready to be shipped out.":(v.section=="preorder"?"These units are not in production and will start once an order is placed.":"These units are either in production or yet to start production. However, they are expected to be ship out in the same timeframe.");
                    btnWrap+=`<input type="radio" id="del-time-virtual-${v.name}" value="${v.name.toLowerCase()}" name="delOption" class="del-input" data-desp="${desp}"><label for="del-time-virtual-${v.name}" class="del-label">${lb}</label>`;
                    selectWrap+=`<option value="${v.name.toLowerCase()}" data-desp="${desp}">${lb}</option>`;
                }
            }
            if (virtualSBtn.length>0) {
                for (let v of virtualSBtn) {                                
                    let lb = v.replace("M"," months").replace("_","-");
                    let desp = "These units are not in production and will start once an order is placed.";
                    btnWrap+=`<input type="radio" id="del-time-virtual-${v}" value="${v.toLowerCase()}" name="delOption" class="del-input" data-desp="${desp}"><label for="del-time-virtual-${v}" class="del-label">${lb}</label>`;
                    selectWrap+=`<option value="${v.toLowerCase()}" data-desp="${desp}">${lb}</option>`;
                }
            }
            selectWrap+="</select>";     
            // console.log(btnWrap);               
            // $(".delivery-wrap").append(`<div class="del-btn-wrap">${btnWrap}</div><div class="del-select-wrap">${selectWrap}</div><div class="del-content-wrap del-content-hidden">${dlTBody}</div>`).show();
            $(".del-content-wrap").before(`<div class="del-btn-wrap">${btnWrap}</div><div class="del-select-wrap">${selectWrap}</div>`);        
            $("input[type=radio][name=delOption]").change((event) => {                  
                this.embeddedEalierSection(event.currentTarget.value);
                $(`.del-select-wrap select option[value=${event.currentTarget.value}]`).prop("selected",true);
                // $(".del-item-wrap").hide();
                // let val = $(this).val();                                                
                // $(".del-item-wrap").filter(function(){                                                                                        
                //     return Number(this.getAttribute(`data-qty-${val}`))>0;
                // }).show();
            });
            $(".del-select-wrap select").change((event) => {                  
                this.embeddedEalierSection(event.currentTarget.value);
                $(`input[type=radio][name=delOption][value=${event.currentTarget.value}]`).prop("checked",true);
            });
            $("input[type=radio][name=delOption]").eq(0).prop("checked", true).trigger("change");
            if ($(window).width()>700) {
                $("[shipping-time-label] span").html(`Try quick check ${this.$pSKUList[0]["Part Number"]} all available options by delivery time`);
                $("[shipping-time-label] img").attr("src","/content/images/common/thunder.svg").removeClass("loading");
            } else {
                if ($(window).width()>550) {
                    $("[shipping-time-label] span").html(`Try quick check<br/> <span style="margin-left: 20px;">${this.$pSKUList[0]["Part Number"]} all available options by delivery time</span>`);
                    $(".custom-attribute-wrap[black] .link-inventory").css({"margin-left":"20px"});
                } else {
                    $("[shipping-time-label] span").html(`Try quick check<br/> <span>${this.$pSKUList[0]["Part Number"]} all available options by delivery time</span>`);
                }
                $("[shipping-time-label] img").attr("src","/content/images/common/thunder.svg").removeClass("loading");
                $(".custom-attribute-wrap[black] span").after(`<br/>`);                
            }
            // $("[shipping-time-label]").show().on("click", function() {
            //     $(".delivery-wrap").slideToggle();
            // });
        }
        $(".delivery-wrap").show();
    }
    getDeliverList(data) {        
        if (data.sku) {
            this.$pCurrent = data;
            fetch(`//shp-webserver-temp.glitch.me/get-teamdesk`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    table: 'Inventory',
                    filter: encodeURIComponent(`Any([Part Number],'${data.sku}')`)
                })
            })
            .then(r=>r.json())
            .then(d=> {
                // console.log(d);
                if (d.length>0) {
                    this.$pSKUList = d;                    
                } else if (data.stock) {
                    this.$pSKUList = [];
                    $('[data-product-stock]').text(data.stock);
                    $('[data-stock-label]').css({"display": "inline-block"});
                }

                fetch(`//shp-webserver-temp.glitch.me/get-teamdesk`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        table: 't_763479',
                        options: `?filter=Any([Part Number],'${encodeURIComponent(data.sku)}') and [Incoming Quantity]>0 and [Arrival Due Date]>ToDate('1/1/1')&sort=Arrival Due Date//ASC`                        
                    })
                })
                .then(r=>r.json())
                .then(d=> {
                    console.log(d);
                    if (d.length>0) {
                        this.$poSKUList = d;
                    }
                    if (this.$pSKUList.length>0) {
                        console.log(this.$pSKUList);
                        // if (this.$allureException.includes(this.$pSKUList[0]["Part Number"].toLowerCase())==false) {
                        //     // this.setEarliestTimeNoAllure();
                        //     this.setEarliestTimeNoAllureTest();
                        // } else {
                        //     this.setEarliestTimeAllure();
                        // }
                        this.getModifiers();
                    } else {
                        $("[shipping-time-label]").hide();
                    }
                })
                .catch(e=> {
                    console.log(e);                
                })
            })
            .catch(e=> {
                console.log(e);
                if (data.stock) {
                    this.$pSKUList = [];
                    $('[data-product-stock]').text(data.stock);
                    $('[data-stock-label]').css({"display": "inline-block"});
                }
            });  
        }
    }
    getTeamdeskInventoryBySKU(data) {        
        if (data.sku) {            
            fetch(`//shp-webserver-temp.glitch.me/get-teamdesk`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    table: 'Inventory',
                    filter: encodeURIComponent(`Any([SKU],'${data.sku}')`)
                })
            })
            .then(r=>r.json())
            .then(d=> {                       
                if (d.length>0) {
                    this.updateDeliverTime(data, d);
                } else if (data.stock) {
                    $('[data-product-stock]').text(data.stock);
                    $('[data-stock-label]').css({"display": "inline-block"});
                }
            })
            .catch(e=>{
                console.log(e);
                if (data.stock) {
                    $('[data-product-stock]').text(data.stock);
                    $('[data-stock-label]').css({"display": "inline-block"});
                }
            });
        }
    }
    updateDeliverLabelWithPending(item) {
        let qty = Number($("[id='qty[]']").val());
        if (Number(item["Available Quantity"]) >= qty) {
            $("input#form-action-addToCart").attr("disabled", false);
            $("input#form-action-addToCart").attr("readonly", false);
            $("input#form-action-addToCart").val("Add to Cart");
            $(".productView-details").find(".form-field.form-field--increments").eq(0).before('<div class="productView-deliver" style="font-weight: bold;">Expect to ship out 1 - 3 days later</div>');
        } else if (item["Virtual Location"]) {
            if (Number(item["Available Quantity"]) > 0) {
                $("input#form-action-addToCart").attr("disabled", true);
                $("input#form-action-addToCart").attr("readonly", true);
                $("input#form-action-addToCart").val("Over Sold");
            } else {
                $("input#form-action-addToCart").attr("disabled", false);
                $("input#form-action-addToCart").attr("readonly", false);
                $("input#form-action-addToCart").val("Add to Cart");
                if (item["Lock Status"]!="Locked for processing" && (Number(item["Available Quantity"])+Number(item["Unlocked for sale quantity"]))>=qty) {
                    $(".productView-details").find(".form-field.form-field--increments").eq(0).before(`<div class="productView-deliver" style="font-weight: bold;">Expect to ship out 1 week later</div>`); 
                } else {
                    let regex = /[1-9_]+M/g;
                    let t = item["Virtual Location"].match(regex);
                    if (t.length>0) {
                        t = t[0].substring(0,t[0].length-1);
                        if (t.length>0) {
                            if (t>1) {
                                $(".productView-details").find(".form-field.form-field--increments").eq(0).before(`<div class="productView-deliver" style="font-weight: bold;">Shipping could take up to ${t.replace('_','-')} month${t>1?'s':''}</div>`); 
                            } else {
                                $(".productView-details").find(".form-field.form-field--increments").eq(0).before(`<div class="productView-deliver" style="font-weight: bold;">Expect to ship out ${t.replace('_','-')} month${t>1?'s':''} later</div>`); 
                            }
                        }
                    }
                }
            }
        }
        let ip = [];
        if (Number(item["Available Quantity"]) > 0) {
            if (Number(item["Available Quantity"])>10) {
                ip.push(`Current stock: More than 10`);
            } else {
                ip.push(`Current stock: ${Number(item["Available Quantity"])}`);
            }            
        } else {
            if (item["Virtual Location"]) {
                if (item["Lock Status"]!="Locked for processing" && (Number(item["Available Quantity"])+Number(item["Unlocked for sale quantity"]))>=qty) {
                    ip.push(`In transit: ${Number(item["Available Quantity"])+Number(item["Unlocked for sale quantity"])}`);
                } else if (Number(item["Available Quantity"])+Number(item["Quantity Incoming"]) -Number(item["Total Request Quantity"])-2 >= qty){
                    // console.log(this.$poSKUList);
                    console.log("pending incoming");
                    let inItems = this.$poSKUList.filter(po=>po.SKU.toUpperCase() == item["SKU"].toUpperCase());                    
                    if (inItems.length>0) {
                        let cPO = this.getIncomingTime(Number(item["Available Quantity"]), inItems, Number(item["Total Request Quantity"])+2, qty);                        
                        if (cPO) {
                            let inItem = inItems[cPO.i];
                            let date = new Date(inItem["Arrival Due Date"]);
                            date = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
                            console.log(new Date() > date);
                            if (new Date() > date) {
                                if (this.$allureException.includes(inItem["Part Number"].toLowerCase())) {
                                    // date = new Date(Date.now()+864E5*90);
                                    date = new Date();
                                    date = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
                                    date.setMonth(date.getMonth()+3);
                                } else {
                                    // date = new Date(Date.now()+864E5*30);
                                    date = new Date();
                                    date = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
                                    date.setMonth(date.getMonth()+1);
                                }
                            } else if (this.$allureException.includes(inItem["Part Number"].toLowerCase())) {
                                date.setMonth(date.getMonth()+2);
                            }
                            const options = {year: 'numeric', month: 'long'};
                            ip.push(`In production: ${cPO.qPO}`);
                            $(".productView-deliver").html(`Expect to ship out in ${date.toLocaleDateString('en-US', options)}`);
                        }                        
                    }
                }
                if (Number(item["Virtual Quantity"])+Number(item["Available Quantity"])>10) {
                    ip.push(`Allowed Pre-order: More than 10`);
                } else {
                    ip.push(`Allowed Pre-order: ${Number(item["Virtual Quantity"])+Number(item["Available Quantity"])}`);
                }
            }            
        }
        if (ip.length>0) {
            ip = ['Quantity:',...ip];
        }
        $('[data-product-stock]').html(ip.join('<br/>'));
        $('[data-stock-label]').css({"display": "none"});
        $(".productView-deliver").after("<span class='productView-tooltip'></span><span class='productView-tooltip-text'>This is an estimate. We are getting shipments weekly so you can receive your order quicker.</span>");
    }
    updateDeliverLabel(item) {
        let qty = Number($("[id='qty[]']").val());
        if (Number(item["WH1"])>=qty) {
            $("input#form-action-addToCart").attr("disabled", false);
            $("input#form-action-addToCart").attr("readonly", false);
            $("input#form-action-addToCart").val("Add to Cart");
            $(".productView-details").find(".form-field.form-field--increments").eq(0).before('<div class="productView-deliver" style="font-weight: bold;">Expect to ship out immediately</div>');
        } else if (Number(item["Available Quantity"]) >= qty) {
            $("input#form-action-addToCart").attr("disabled", false);
            $("input#form-action-addToCart").attr("readonly", false);
            $("input#form-action-addToCart").val("Add to Cart");
            $(".productView-details").find(".form-field.form-field--increments").eq(0).before('<div class="productView-deliver" style="font-weight: bold;">Warehouse transfer, expect ship out 2-4 days later</div>');
        } else if (item["Virtual Location"]) {
            if (Number(item["Available Quantity"])>0) {
                $("input#form-action-addToCart").attr("disabled", true);
                $("input#form-action-addToCart").attr("readonly", true);
                $("input#form-action-addToCart").val("Over Sold");
            } else {
                $("input#form-action-addToCart").attr("disabled", false);
                $("input#form-action-addToCart").attr("readonly", false);
                $("input#form-action-addToCart").val("Add to Cart");
                if (item["Lock Status"]!="Locked for processing" && Number(item["Unlocked for sale quantity"])>=qty) {
                    $(".productView-details").find(".form-field.form-field--increments").eq(0).before(`<div class="productView-deliver" style="font-weight: bold;">Expect to ship out 1 week later</div>`); 
                } else {
                    let regex = /[1-9_]+M/g;
                    let t = item["Virtual Location"].match(regex);
                    if (t.length>0) {
                        t = t[0].substring(0,t[0].length-1);
                        if (t.length>0) {
                            if (t>1) {
                                $(".productView-details").find(".form-field.form-field--increments").eq(0).before(`<div class="productView-deliver" style="font-weight: bold;">Shipping could take up to ${t.replace('_','-')} month${t>1?'s':''}</div>`); 
                            } else {
                                $(".productView-details").find(".form-field.form-field--increments").eq(0).before(`<div class="productView-deliver" style="font-weight: bold;">Expect to ship out ${t.replace('_','-')} month${t>1?'s':''} later</div>`); 
                            }                            
                        }
                    }
                }
            }
        }
        let ip = [];
        if (Number(item["Available Quantity"])>0){
            if (Number(item["2"])>10) {
                ip.push(`US Warehouse: More than 10`);
            } else if (Number(item["2"])>0) {
                ip.push(`US Warehouse: ${item["2"]}`);
            }
            if (Number(item["WH1"])>10) {
                ip.push(`Canada Warehouse: More than 10`);
            } else if (Number(item["WH1"])>0) {
                ip.push(`Canada Warehouse: ${item["WH1"]}`);
            }          
        } else {
            if (item["Virtual Location"]) {
                console.log("no pending");
                if (item["Lock Status"]!="Locked for processing" && Number(item["Unlocked for sale quantity"])>=qty) {
                    ip.push(`In transit: ${Number(item["Unlocked for sale quantity"])}`);
                } else if (Number(item["Quantity Incoming"])-Number(item["Total Request Quantity"])-2 >= qty){
                    let inItems = this.$poSKUList.filter(po=>po.SKU.toUpperCase() == item["SKU"].toUpperCase())
                    if (inItems.length>0) {
                        let cPO = this.getIncomingTime(Number(item["Available Quantity"]), inItems, Number(item["Total Request Quantity"])+2, qty);
                        if (cPO) {
                            let inItem = inItems[cPO.i];
                            let date = new Date(inItem["Arrival Due Date"]);                             
                            date = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
                            if (new Date() > date) {
                                if (this.$allureException.includes(inItem["Part Number"].toLowerCase())) {
                                    // date = new Date(Date.now()+864E5*90);
                                    date = new Date();
                                    date = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
                                    date.setMonth(date.getMonth()+3);
                                } else {
                                    // date = new Date(Date.now()+864E5*30);
                                    date = new Date();
                                    date = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
                                    date.setMonth(date.getMonth()+1);
                                }
                            } else if (this.$allureException.includes(inItem["Part Number"].toLowerCase())) {
                                date.setMonth(date.getMonth()+2);
                            }
                            const options = { year: 'numeric', month: 'long' };
                            ip.push(`In production: ${cPO.qPO}`);
                            $(".productView-deliver").html(`Expect to ship out in ${date.toLocaleDateString('en-US', options)}`);
                        }  
                    }
                }
                if (Number(item["Virtual Quantity"])+Number(item["Available Quantity"])>10) {
                    ip.push(`Allowed Pre-order: More than 10`);
                } else {
                    ip.push(`Allowed Pre-order: ${Number(item["Virtual Quantity"])+Number(item["Available Quantity"])}`);
                }
            }
        }
        if (ip.length>0) {
            ip = ['Quantity:',...ip];
        }   
        $('[data-product-stock]').html(ip.join('<br/>'));
        $('[data-stock-label]').css({"display": "none"});
        $(".productView-deliver").after("<span class='productView-tooltip'></span><span class='productView-tooltip-text'>This is an estimate. We are getting shipments weekly so you can receive your order quicker.</span>");
    }
    updateDeliverTime(data, sList=null) {        
        $(".productView-deliver").remove();
        $(".productView-tooltip").remove();
        $(".productView-tooltip-text").remove();
        let arrCheck = sList?sList:this.$pSKUList;
        if (arrCheck.length>0 && data.sku) {            
            this.$pCurrent = data;
            let item = arrCheck.find(p=>p.SKU.toUpperCase()==data.sku.toUpperCase());
            if (item) {                
                if (Number(item["Available Quantity"])!= Number(item["Total On Hand"])) {
                    this.updateDeliverLabelWithPending(item);
                } else {
                    this.updateDeliverLabel(item);
                }
            } else if (sList==null) {                
                this.getTeamdeskInventoryBySKU(data);
            }
        } else if (sList==null) {            
            this.getTeamdeskInventoryBySKU(data);
        }
    }

    initProductAttributes(data) {        
        const behavior = data.out_of_stock_behavior;
        const inStockIds = data.in_stock_attributes;
        const outOfStockMessage = ` (${data.out_of_stock_message})`;

        this.showProductImage(data.image);

        if (behavior !== 'hide_option' && behavior !== 'label_option') {
            return;
        }

        $('[data-product-attribute-value]', this.$scope).each((i, attribute) => {
            const $attribute = $(attribute);
            const attrId = parseInt($attribute.data('product-attribute-value'), 10);


            if (inStockIds.indexOf(attrId) !== -1) {
                this.enableAttribute($attribute, behavior, outOfStockMessage);
            } else {
                if (!this.$hasSoldOut) {
                    this.$hasSoldOut = true;
                }
                this.disableAttribute($attribute, behavior, outOfStockMessage);
            }
        });
    }

    /**
     * Hide or mark as unavailable out of stock attributes if enabled
     * @param  {Object} data Product attribute data
     */
    updateProductAttributes(data) {
        const behavior = data.out_of_stock_behavior;
        const inStockIds = data.in_stock_attributes;
        const outOfStockMessage = ` (${data.out_of_stock_message})`;

        this.showProductImage(data.image);

        if (behavior !== 'hide_option' && behavior !== 'label_option') {
            return;
        }

        $('[data-product-attribute-value]', this.$scope).each((i, attribute) => {
            const $attribute = $(attribute);
            const attrId = parseInt($attribute.data('product-attribute-value'), 10);


            if (inStockIds.indexOf(attrId) !== -1) {
                this.enableAttribute($attribute, behavior, outOfStockMessage);
            } else {
                this.disableAttribute($attribute, behavior, outOfStockMessage);
            }
        });
    }

    disableAttribute($attribute, behavior, outOfStockMessage) {
        if (this.getAttributeType($attribute) === 'set-select') {
            return this.disableSelectOptionAttribute($attribute, behavior, outOfStockMessage);
        }

        if (behavior === 'hide_option') {
            $attribute.hide();
        } else {
            $attribute.addClass('unavailable');
        }
    }

    disableSelectOptionAttribute($attribute, behavior, outOfStockMessage) {
        const $select = $attribute.parent();

        if (behavior === 'hide_option') {
            $attribute.toggleOption(false);
            // If the attribute is the selected option in a select dropdown, select the first option (MERC-639)
            if ($attribute.parent().val() === $attribute.attr('value')) {
                $select[0].selectedIndex = 0;
            }
        } else {
            $attribute.attr('disabled', 'disabled');
            $attribute.html($attribute.html().replace(outOfStockMessage, '') + outOfStockMessage);
        }
    }

    enableAttribute($attribute, behavior, outOfStockMessage) {
        if (this.getAttributeType($attribute) === 'set-select') {
            return this.enableSelectOptionAttribute($attribute, behavior, outOfStockMessage);
        }

        if (behavior === 'hide_option') {
            $attribute.show();
        } else {
            $attribute.removeClass('unavailable');
        }
    }

    enableSelectOptionAttribute($attribute, behavior, outOfStockMessage) {
        if (behavior === 'hide_option') {
            $attribute.toggleOption(true);
        } else {
            $attribute.removeAttr('disabled');
            $attribute.html($attribute.html().replace(outOfStockMessage, ''));
        }
    }

    getAttributeType($attribute) {
        const $parent = $attribute.closest('[data-product-attribute]');

        return $parent ? $parent.data('product-attribute') : null;
    }

    /**
     * Allow radio buttons to get deselected
     */
    initRadioAttributes() {
        $('[data-product-attribute] input[type="radio"]', this.$scope).each((i, radio) => {
            const $radio = $(radio);

            // Only bind to click once
            if ($radio.attr('data-state') !== undefined) {
                $radio.click(() => {
                    if ($radio.data('state') === true) {
                        $radio.prop('checked', false);
                        $radio.data('state', false);

                        $radio.change();
                    } else {
                        $radio.data('state', true);
                    }

                    this.initRadioAttributes();
                });
            }

            $radio.attr('data-state', $radio.prop('checked'));
        });
    }
}
