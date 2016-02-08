
//= require map/route_list_control.js
//= require map/routes_filters_control.js

/*
  ********************** UTILS ********************
*/
function showLoader(el){
  $(el).css({position: "relative", padding: 0});    
  $(el).append("<div class='loader'><i class='fa fa-spinner fa-spin spinner'></i></div>");
}
function hideLoader(el){
  $(el).css({position: "initial", padding: ""});
  $(el).find(".loader").remove();
}


var init_map = function (controls_list){       
  var map = L.map("map", { zoomControl: false });
  var tileUrl = 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  var osmAttrib='Map data © <a href="http://openstreetmap.org">OpenStreetMap</a> contributors';
  var tile  = new L.TileLayer(tileUrl, {minZoom: 10, maxZoom: 16, attribution: osmAttrib})   
  map.addLayer(tile);
  console.log("map", map)
  //TODO
  //вынести в прототип
  map.findLayerByType = function(type){  
    //console.log("[FUNCTION]findLayerByType",this, type)
    return this.filterLayerByParams({markerType: type})
  };

  map.filterLayerByParams = function(params){
    console.log("[FUNCTION] filterLayerByParams",params)
    var finded = []
    this.eachLayer(function(layer){
      if(layer.options){
        var res = true
        for(var param in params){          
          res &= layer.options[param] == params[param]
        }
        if(res)
          finded.push(layer)
      }
    })
    return finded;
  }

  map.removeLayersWithTypeName = function(type){
    var layers = this.findLayerByType(type),
        self = this;
    layers.forEach(function(l){
      self.removeLayer(l);
    })
  }

  if(controls_list){
    map.addControl(new RoutesListControl());
    map.addControl(new RoutesFiltersControl());
  }
  
  //positionOnCity(map);
  return map;
};

//Удаляет с карты слой с маршрутом и остановками
function cleanRoutesLayer(map){
  if(map.layer_group){
    map.removeLayer(map.layer_group)
  }
}


function drawRoutes(direction, routeName, page){
  console.log("[ADD ROUTES]",direction, routeName, page)
  stops = direction.stops;
  var track = direction.corridors[0].points;
  var map = document.map_div;
  var layer_group = L.layerGroup();
  cleanRoutesLayer(map);
  var routeLayer = L.polyline(track, { routeName: routeName, opacity: 0.5 });     
  layer_group.addLayer(routeLayer);

  var stop_layer = new L.MarkerClusterGroup();    
  stops.forEach(function (stop, index) {       
    //var coords = parseCoords(stop.zones[0].center[0], stop.zones[0].center[1]);
    var  coords = stop.zones[0].center;
    var marker = L.AwesomeMarkers.icon({
      icon: 'bus-stop'      
    });
    //console.log("[DRAW STOP MARKER]",stop.name, routeName, stop)
    var stop_marker = L.marker(coords,{
      title: stop.name, 
      route_name: routeName , 
      direction_letter: direction.directionLetter, 
      stop_zone_id: stop.zones[0].id,
      stop_id: stop.id, 
      icon: marker
    });
    if(page == "route_card"){
      stop_marker.bindPopup(getStopPopup(stop,{ title: 'Остановка', show_next_bus:true }));
    }else{
      stop_marker.bindPopup(getStopPopup(stop, { title: 'Расписание остановки', show_shedule: true }));
    }

    stop_marker.on('click',function(e){   
      focusOnStop(this, map, e);
    });
    stop_layer.addLayer(stop_marker);           
  })  
  layer_group._stop_layer = stop_layer;     
  layer_group.addLayer(stop_layer);

  map.addLayer(layer_group);        
  map.layer_group = layer_group;
  map.fitBounds(routeLayer.getBounds());
}

function focusOnStop(stop_marker, map, e){    
  console.log("[FOCUS ON STOP]",stop_marker, e)
  if(!map){
    map = document.map_div;   
  }     
  var stop_layer = document.map_div.layer_group._stop_layer;    
  if(!stop_marker){
    stop_marker = findStopMarker(e, stop_layer);            
  }
  var show_next_bus = stop_marker.getPopup()._content.opts.show_next_bus;
  stop_layer.zoomToShowLayer(stop_marker, function(e){      
    map.setView(stop_marker.getLatLng());    
    stop_marker.openPopup()         
  });
}

/*
  Поиска марекра остановки по ее идентификатору
*/
function findStopMarker(stop_id, stop_layer){
  var route_layer = document.map_div.layer_group;
  var founded_stop_marker;
  stop_layer.eachLayer(function(stop_marker){         
    if(stop_marker.options.stop_id == stop_id){
      //console.log("founded!",stop_marker ,stop_layer)
      founded_stop_marker = stop_marker;
    }
  })
  //console.log("[SELECTED STOP MARKER]",founded_stop_marker)
  return founded_stop_marker;
}

/*
  Актуализация координат мобильных объектах маршрута на карте,
  с последующим позиционированием на запрашиваемым мобильном объекте.
  
    #{bus_id} идентификатор запрашиваемого мобильного объекта
    #{route_name} наименование маршрута
*/

function focusOnBus(bus_id, route_name){      
  if(!bus_id)
    return
  $.when(loadBusesData(route_name))
    .done(function(result){      
      //console.log("LOADED BUSES DATA",result)
      var buses = result,
          selected_bus = buses.filter(function(bus){ return bus.id == bus_id})[0],
          direction_letter = selected_bus.directionLetter,
          map = document.map_div;

      // Активанция текущего направления маршрута автобуса
      $(".directions>li").filter(function(indx, el){
        return $(el).children().eq(0).text()==direction_letter && !$(el).hasClass("active")
      }).click();

      drawBusOnMap(buses, direction_letter);  
      var res = map.filterLayerByParams({markerType: "bus", bus_id: bus_id});

      if(res){
        res[0].openPopup()
        map.setView(res[0].getLatLng(), 14)
      }      
  });    
}

function drawBusOnMap(objects, direction_letter, map){
  //console.log("[FUNCTION]drawBusOnMap",objects, direction_letter);
  if(!objects)
    return
  if(!map)
    map = document.map_div;  
  map.removeLayersWithTypeName("bus")
  var bus_on_direction = objects.filter(function(bus){ return bus.directionLetter == direction_letter });
  //console.log("bus",bus_on_direction)
  bus_on_direction.forEach(function(object){
    var coords = parseCoords(object.lat, object.lon);
    var marker = L.AwesomeMarkers.icon({
      icon: 'fa fa-bus',
      markerColor: 'green'
    });
    var bus_marker = L.marker(coords,{
      title: object.statenum, 
      bus_id: object.id,
      icon: marker, 
      markerType: "bus", 
      zIndexOffset: 1000
    });
    bus_marker.bindPopup(getBusPopup(object));
    bus_marker.on('click', function(e){
      //console.log("bus marker clicked",e, bus_marker)
      bus_marker.openPopup();
    })
    map.addLayer(bus_marker);    
  })  
}

/*
  Возвращает панель содержащую:
   - наименование остановки
   - расписание маршрута
*/
function getBusPopup(bus){
  //console.log("[GET STOP POPUP]",stop)
  var container = L.DomUtil.create('div','bus-popup');

  L.DomUtil.create('h4','',container).innerHTML = "Автобус";  
  addInfo("Государственный номер", bus.gosnum);
  //addInfo("Предыдущая остановка", bus.moveFrom);    
  if(bus.nextstop){
    addInfo("Следующая остановка", bus.nextstop.name);  
    addInfo("Время прибытия по графику", bus.nextstop.time);
  }
  if(bus.priorstop){
    if(bus.priorstop.difference && bus.priorstop.difference != 0){
      var difference = Math.abs(bus.priorstop.difference/60);
      difference = Math.ceil(difference)+" мин.";
      addInfo(bus.priorstop.difference<0?"Отставание":"Опережение", difference);  
      if(bus.nextstop)
        addInfo("Прогнозируемое время прибытия", bus.nextstop.coming);
    }        
  }
  //addInfo("Количество мест", bus.kolvo);

  function addInfo(label, data){
    if(!data)
      return;
    L.DomUtil.create('h5','',container).innerHTML=label;
    L.DomUtil.create('div','',container).innerHTML=data;
  }
  //console.log("Bus popup", container)
  return L.popup({keepInView: true}).setContent(container);
}


function parseCoords(lat,lon){
  return L.latLng(
      parseFloat(lat.replace(/[,]+/g, '.')),
      parseFloat(lon.replace(/[,]+/g, '.'))
    );
}
/*
  Возвращает панель содержащую:
   - наименование остановки
   - расписание маршрута
*/
function getStopPopup(stop, opts){
  //console.log("[GET STOP POPUP]",stop)
  var container = L.DomUtil.create('div','stop-popup'),
      title = L.DomUtil.create('h5','',container);
  title.innerHTML = opts.title;
  container.opts = opts;
  L.DomUtil.create('div','stop-name',container).innerHTML=stop.name;
  if(opts.show_shedule){
    if(stop.comings){     
      drawSheduleTable(stop.comings,container);
    } else {
      L.DomUtil.create('div','',container).innerHTML="Нет данных";
    }
  }
  // if(opts.show_next_bus){
  //   L.DomUtil.create('h5','',container).innerHTML= "Ближайший автобус"
  //   L.DomUtil.create('div','next-bus-coming',container).innerHTML= "Нет данных"
  // }    
  return L.popup({keepInView: true}).setContent(container);
}

/*
  Функция возвращающая ассоциативный массив,
  сгруппированного по часам расписания движения автобуса (comings)
*/
function getSchedule(comings){      
  //console.log("[FUNCTION] getSchedule",comings);
  return comings.reduce(function(data,el){
    var time = moment(el);         
    if(!time) return data;
    if(data[time.format("HH")]==null){
      data[time.format("HH")]=[]
    };
    data[time.format("HH")].push(time.format("mm"));
    return data;
  },{});    
}

/*
  Добавляет в элемент container таблицу, шириной max_hour_in_row*2 колонок
  в которой отображается информация о расписание движения автобуса (times)
  сгруппированное по часам прибытия.
*/
function drawSheduleTable(route_comings, container, max_hour_in_row){
  //console.log("[FUNCTION]drawSheduleTable",route_comings, container)
  if(route_comings==null || route_comings.length==0){
    var div = L.DomUtil.create('div','no-data',container);
    div.innerHTML = "Нет данных"
    return;
  }
  var times = getSchedule(route_comings);
  if(!max_hour_in_row)
    max_hour_in_row= 3;
  //Сортируем расписание по часам для корректного вывода      
  var hours = Object.keys(times).sort();
  var schedule = L.DomUtil.create('table','stop-schedule',container);
  //var row = L.DomUtil.create('tr','',schedule);
  var now_hour = moment().format("HH");
  for(var i=0; i<hours.length; i++){        
      var hour = hours[i]+""; //боремся с типизацией        
      if(i%max_hour_in_row == 0){         
        row = L.DomUtil.create('tr','',schedule);
      }
      var cell_cls = now_hour > hour? "pass" : "";
      var hour_cell = L.DomUtil.create('td',cell_cls,row);       
      hour_cell.innerHTML=hour;
      hour_cell.setAttribute("title", "Час");
      var minuts_panel = L.DomUtil.create('td',cell_cls,row);       
      times[hour].forEach(function(minuts, index){                                
        var minuts_cell = L.DomUtil.create('div','',minuts_panel);
        minuts_cell.innerHTML = minuts; 
        minuts_cell.setAttribute("title", "Минуты");
      })        
    }
}

function showSchedule(route_name, route_comings, container_selector, max_hour_in_row){    
  //console.log("container", container_selector?container_selector+" .stop-plan":".stop-plan")
  var container = $(container_selector?container_selector+" .stop-plan":".stop-plan")[0],
      stop_name_container = $(container_selector?container_selector+" .stop-name":".stop-name")[0];    
  stop_name_container.innerHTML = route_name;
  container.innerHTML = "";
  drawSheduleTable(route_comings,container,max_hour_in_row);
}

//TODO 
function showFactSchedule(route_name, route_comings, container_selector, max_hour_in_row){    
  var container = $(container_selector?container_selector+" .stop-fact":".stop-fact")[0];
     // stop_name_container = $(container_selector?container_selector+" #stop-name":"#stop-name")[0];    
  //stop_name_container.innerHTML = route_name;
  container.innerHTML = "";
  route_comings = route_comings.filter(function(e){return e!=""})
  //console.log("SHOW FACT TIMES",container, route_comings)

  if(route_comings && route_comings.length>0){
    drawSheduleTable(route_comings,container,max_hour_in_row);
  }else{
    container.innerHTML = "Нет данных"
  }
}

/*
  Добавление/удаление объекта из избранных объектов пользователя
  #{el}   иконка избранного объекта
  #{id}   идентификатор объекта
  #{name} наименоваине объекта
  #{type} тип объекта, ожидается route или enterpise
  #{if_favorite} признак, является ли маршрут избранным
*/
function changeFavoriteItem(el, id, name, type, is_favorite){
  //console.log("[CHANGE FAVORITE ITEM]",el, id, name ,type, is_favorite)
  var data = {
    obj_type: type,
    obj_id: id,
    obj_name: name,
    favorite: !is_favorite
  }
  var url = type=="route"? "/transport/routes/"+name : "/transport/enterpises/"+id;   
  $.ajax({
    url: SCOPE + url,
    type: "PUT",
    data: data,
    success: function(e){
      $(el).toggleClass("fa-star-o fa-star")
      msg= "Маршрут №"+name
      msg += is_favorite? " добавлен в избранные маршруты": " удален из избранных маршрутов" 
      growl.info(msg);
      console.log("SUCCESS",e)
    },
    error: function(e){
      console.log("ERROR",e)
    }
  });  
}

var onChangeFavorite = function(e){
  e.stopPropagation();
  var el = e.currentTarget,      
      name = el.parentElement.parentElement.routeName,
      favorite = el.className.indexOf("fa-star-o")>-1;

  //console.log("[CHANGE FAVORITE ITEM]",e, el, name, favorite)
  $.ajax({
    url: SCOPE + "/transport/routes/"+name,
    type: "PUT",
    data: {favorite: favorite},
    success: function(e){
      console.log("[SUCCESS]",e)
      var msg = "Маршрут №"+name+" ";
      msg += favorite? "добавлен в избранные маршруты": "удален из избранных маршрутов" 
      growl.info(msg);
      $(el).toggleClass("fa-star-o fa-star")      
    },
    error: function(e){
      console.log("[ERROR]",e)
    }
  });
  
}

/*
 ****************   [AJAX]   *********************
*/
function loadBusStatus(bus_id){
  return $.ajax({
    url: SCOPE + "/transport/get_transport_status",
    data: {id: bus_id},
    error: function(e){
      console.error("[AJAX] get_transport_status ERROR",e);
    }
  })
}

function loadBusesData(route_name){
  return $.ajax({
    url: SCOPE + "/transport/objects",
    type: "GET",
    data: {name: route_name, full: true},
    error: function(e){
      console.error("[AJAX] get_mobile_objects ERROR",e)
      return null;
    }
  })
}

