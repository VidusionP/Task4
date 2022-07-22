let chartIdx = 0;
function scriptLoader(scripts, callback) {

    var count = scripts.length;

    function urlCallback(url) {
        return function () {                
            console.log(url + ' was loaded (' + --count + ' more scripts remaining).');
            if (count < 1) {
                callback();
            }
        };
    }

    function loadScript(url) {
        var s = document.createElement('script');
        s.setAttribute('src', url);
        s.onload = urlCallback(url);
        document.head.appendChild(s);
    }

    for (var script of scripts) {
        loadScript(script);
    }
};
function onChartFocus() {
    $(".color-chart-slide.active").removeClass("active");
    $(".color-chart-slide").eq(chartIdx).addClass("active");
    $(".color-chart-dot.active").removeClass("active");
    $(".color-chart-dot").eq(chartIdx).addClass("active");
}
function initialChart() {
    fetch("/content/data/color-chart.json")
    .then(r=>r.json())
    .then(d=>{
        console.log(d);
        if (d.tabs)  {
            let htmlTitle = `<li class="color-chart-tab active">
                <div class="color-chart-tab-title">${d.tabs[0].title}</div>
            </li>
            <li class="color-chart-tab">
                <div class="color-chart-tab-title">${d.tabs[1].title}</div>
            </li>`;
            let html = `<div class="color-chart-tab-content active">
                <div>
                    <div class="color-chart-nav color-chart-nav-left"></div>
                    <div class="color-chart-slides">`;
            let htmlDots='';
            for (let i=0; i<d.tabs[0].img.length; i++) {
                let img = d.tabs[0].img[i];                    
                if (i==0) {
                    html+=`<div class="color-chart-slide active">
                        <div class="color-chart-slide-item">
                            <img src="${img.link}" alt="${img.alt}" class="color-chart-slide-item-img">
                        </div>
                    </div>`;
                    htmlDots+=`<div class="color-chart-dot active"></div>`;
                } else {
                    html+=`<div class="color-chart-slide">
                        <div class="color-chart-slide-item">
                            <img src="${img.link}" alt="${img.alt}" class="color-chart-slide-item-img">
                        </div>
                    </div>`;
                    htmlDots+=`<div class="color-chart-dot"></div>`;
                }
            }
            html+=`</div><div class="color-chart-nav color-chart-nav-right"></div></div><div class="color-chart-dots">${htmlDots}</div></div>`;
            html+=`<div class="color-chart-tab-content">
                <div class="color-chart-video-wrapper">
                    <iframe class="color-chart-video" allowfullscreen src="${d.tabs[1].link}?start=0&amp;end=0&amp;autoplay=0&amp;loop=0&amp;rel=1" frameborder="0">
                    </iframe>
                </div>
            </div>`;
            $(".color-chart-tabs").html(htmlTitle);
            $(".color-chart-tabs-body").html(html);
        }
    })
    .catch(e=>console.log(e));

    $("body").on("click", ".color-chart-nav-left", function() {
        if (chartIdx==0) {
            chartIdx = $(".color-chart-slide").length-1;
        } else {
            chartIdx=chartIdx-1;
        }
        onChartFocus();
    });
    $("body").on("click", ".color-chart-nav-right", function() {
        if (chartIdx==$(".color-chart-slide").length-1) {
            chartIdx = 0;
        } else {
            chartIdx=chartIdx+1;
        }
        onChartFocus();
    });
    $("body").on("click", ".color-chart-dot", function() {           
        chartIdx = $(this).index();
        onChartFocus();
    });
    $("body").on("click", ".color-chart-tab", function() {
        let idx = $(this).index();
        $(".color-chart-tab-content.active").removeClass("active");
        $(".color-chart-tab-content").eq(idx).addClass("active");
        $(".color-chart-tab.active").removeClass("active");
        $(".color-chart-tab").eq(idx).addClass("active");
    })
}
window.addEventListener('DOMContentLoaded', (event) => {
    let link = document.createElement("link")
    link.href="/content/css/color-chart.css";
    link.rel="stylesheet";
    document.getElementsByTagName("head")[0].appendChild(link);
    if (window.jQuery) {   
        initialChart();         
    } else {
        scriptLoader(['//ajax.googleapis.com/ajax/libs/jquery/3.6.0/jquery.min.js'], function() {
            initialChart();
        })
    }        
}, false);