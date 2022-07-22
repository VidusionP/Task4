import $ from 'jquery';
import 'foundation-sites/js/foundation/foundation';
import 'foundation-sites/js/foundation/foundation.dropdown';
import utils from '@bigcommerce/stencil-utils';
import ProductDetails from '../common/product-details';
import { defaultModal } from './modal';
import 'slick-carousel';

export default function (context) {
    const modal = defaultModal();

    $('body').on('click', '.quickview', (event) => {
        event.preventDefault();

        const productId = $(event.currentTarget).data('product-id');
        const parentPos = $(`#${productId}`)[0]
        const modal1 = $('.modal-background')
        const bodyRect = document.body.getBoundingClientRect()
        const quickaddPos = event.target.getBoundingClientRect()

        //underneath card positions
        const offset = parentPos.getBoundingClientRect().bottom - bodyRect.top + 50
        const offset1 = parentPos.getBoundingClientRect().left - bodyRect.left

        //quick-add button within popup
        const offset2 = quickaddPos.top - bodyRect.top + 50
        const offset3 = quickaddPos.left - bodyRect.left
        // console.log(offset1)
        const offset4 = (offset1/$(window).width())*100
        // const offset5 = (1 - (offset2/$(window).height()))*100
        // console.log(offset2)
        // console.log($(window).height())
        // console.log((offset2/$(window).height()))
        modal.open({ size: 'small', pos: offset2, pos1: offset4 });
        modal.open({ size: 'small' });

        utils.api.product.getById(productId, { template: 'products/quick-view' }, (err, response) => {
            modal.updateContent(response);

            modal.$content.find('.productView').addClass('productView--quickView');

            modal.$content.find('[data-slick]').slick();

            return new ProductDetails(modal.$content.find('.quickView'), context);
        });
    });
}
