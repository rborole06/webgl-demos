
$(document).ready(function(){
    var handle = $("#range");
    $("#slider").slider({
        create: function(){
            handle.text($(this).slider("value"));
        },
        value: fog_factor,
        min: min,
        max: max,
        step: step,
        slide: function(event, ui) {
            handle.text(ui.value);
            fog_factor = ui.value;
        }
    });
});