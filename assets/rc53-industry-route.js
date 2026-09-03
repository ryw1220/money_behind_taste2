(function(){
  var original=window.mbtLinkClick;
  if(typeof original!=="function")return;
  window.mbtLinkClick=function(event,view,onView){
    if(view&&view.name==="distribution"){
      if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
      return;
    }
    return original(event,view,onView);
  };
})();
