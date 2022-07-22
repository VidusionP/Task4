let submenu = [];
function openSubMenu(e) {    
    if ($(event.currentTarget).hasClass("active")) {
        $(event.currentTarget).removeClass("active");
        $(".menu-submenu-items").remove();
    }
    else {
        $(".menu-item .active").removeClass("active"), $(event.currentTarget).addClass("active");
        let n = submenu.filter((n) => n.name == e);
        if (n.length > 0) {
            $(".menu-submenu-items").remove();
            let e = '<div class="menu-submenu-items">';
            if (n[0].menu) for (let t of n[0].menu) e += `<div class="menu-submenu-item"><a href="${t.link}">${t.name}</a></div>`;
            (e += "</div>"), $(".menu-wrap").append(e);
            let t = $(event.currentTarget).offset();
            t.left + $(".menu-submenu-items").width() <= $(window).width()
                ? $(".menu-submenu-items").css({ left: t.left - $(".menu-wrap").offset().left + "px", top: t.top + 30 - $(".menu-wrap").offset().top + "px" })
                : $(".menu-submenu-items").css({ right: "0px", top: t.top + 30 - $(".menu-wrap").offset().top + "px" }),
                $(".menu-submenu-items").slideDown();
        }
    }
}
window.addEventListener("DOMContentLoaded", (e) => {
    fetch("/content/data/custom-menu.json")
        .then((e) => e.json())
        .then((e) => {
            if ((console.log(e), e.menu)) {
                for (let n of e.menu)
                    n.hasOwnProperty("link")
                        ? n.link.includes(window.location.pathname) && n.link.length - window.location.pathname.length <= 2
                            ? $(".menu-items").append(`<div class="menu-item active"><a href="${n.link}">${n.name}</a></div>`)
                            : $(".menu-items").append(`<div class="menu-item"><a href="${n.link}">${n.name}</a></div>`)
                        : (submenu.push({ name: n.name, menu: n.subMenu }),
                            $(".menu-items").append(`<div class="menu-item"><a href="#" onclick="openSubMenu('${n.name}')">${n.name}</a></div>`));
                $(".menu-wrap").show();
            }
        })
        .catch((e) => console.log(e));
    $(document).on("click", function(event) {                            
        if ($(event.target).parent().hasClass("menu-item")==false) {
            $(".menu-item a").removeClass("active");
            $(".menu-submenu-items").remove();
        }
    })
});