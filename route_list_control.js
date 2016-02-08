var RoutesListControl = L.Control.extend({    
  options: {
    position: 'topleft'
  },
  components:{
    title:null,
    route_list:null,
    not_found_panel:null
  },    
  onAdd: function (map) {     
    showLoader(container);
    var components = this.components;
    var container = L.DomUtil.create('div','leaflet-bar route-list-control');
    components.title = L.DomUtil.create('h4','',container);
    components.title.innerHTML = 'Список маршрутов';      
    components.route_list = L.DomUtil.create('ul','',container);
    components.not_found_panel = L.DomUtil.create('div','not-found hidden',container);    

    this.loadData();
    map.route_list_control = this;
    return container;
  },

  addRouteItem: function(name, direction, is_favorite){   
    //console.log("[ADD ROUTE ITEM]", name, direction)
    var container = this.components.route_list;
    var radio_item = L.DomUtil.create('li','',container);   
    radio_item.routeName = name;  
    radio_item.directions = direction;
    L.DomUtil.create('div','route_num',radio_item).innerHTML = name;    
    var route_name = L.DomUtil.create('div','route-direction',radio_item);    
    L.DomUtil.create('div','',route_name);
    L.DomUtil.create('div','',route_name);        

    radio_item.setDirectionName = function(current_direction){
      //console.log("setDirectionName", this, this.childNodes)
      var route_name_container = this.childNodes[1];
      var route_name_from = route_name_container.childNodes[0];
      var route_name_to = route_name_container.childNodes[1];
      route_name_container.parentElement.setAttribute("data-direction-string", current_direction.directionString);

      //TODO костыль из-за того что route_find возвращает только directionString
      //Разбиваем directionString на две строки, соотвествуюие наименованию конечных остановок            
      direction_stops_name = current_direction.directionString.split(" - ");    
      route_name_from.innerHTML = "<span>От</span>"+direction_stops_name[0];  
      route_name_to.innerHTML = "<span>До</span>"+direction_stops_name[1];
    }

    var button_group = L.DomUtil.create('div','button-group',radio_item);
    var detail_info = L.DomUtil.create('div','route-details',radio_item);   

    addTextWithLabel("Время",null, detail_info);
    addTextWithLabel("Интервал",null, detail_info);
    addTextWithLabel("Стоимость", null, detail_info);   

    
    
    // Иконка открытия карты маршрута
    var openCardIcon = L.DomUtil.create('a','fa fa-folder-open-o route_open_card',button_group);
    openCardIcon.setAttribute('title','Открыть карту маршрута');
    openCardIcon.setAttribute('href','/transport/routes/'+encodeURIComponent(name));
    //Останавливаем всплытие, чтобы не вызвалась отрисовка маршрута на li
    $(openCardIcon).on('click',function(e){
       e.stopPropagation();     
    })      
    
    //Иконка добавления в избранное
    var favorite_btn_cls = is_favorite? 'fa-star':'fa-star-o';
    favorite_btn_cls+=' fa favorite-route'    
    var favorite_btn = L.DomUtil.create('i',favorite_btn_cls,button_group);
    favorite_btn.setAttribute('title','Добавить в избранные маршруты');
    $(favorite_btn).on("click", onChangeFavorite);    
    
    if(Array.isArray(direction)){               
      //console.log("[ROUTE ITEM][MULTIPLY DIRECTION]",direction);      
      //Иконка выбора направления маршрута
      var switch_direction = L.DomUtil.create('i','fa fa-retweet route-switch-direction',button_group);
      $(switch_direction).click(onDirectionChange);
      var direction_number_span = L.DomUtil.create('span','',switch_direction);
      direction_number_span.innerHTML = direction.length;
      switch_direction.setAttribute('title','Сменить направление маршрута');

      radio_item.setAttribute('data-direction-index',0);      
      radio_item.setDirectionName(direction[0], route_name);            
    }else{
      radio_item.setDirectionName(direction, route_name);
    }       
    
    $(radio_item).on("click", onRouteItemClick);
  },

  loadData: function(filters){
    var components = this.components,
        self = this;
    showLoader(self.getContainer());
    //console.log("[LOAD DATA]",filters);
    if(filters){
      this.reset();
    }    
    $.ajax({
        url: SCOPE+"/transport/routes",
        data: filters,
        dataType: 'json',
        cache: false,
        success: function(data){
          //console.log("SUCCESS",data);            
          if(data && data.length>0){
            components.route_list.innerHTML = "";
            data.forEach(function(route){
              self.addRouteItem(route.name, route.direction, route.favorite);
            })
          }else if(filters){
            self.notFound();
          }else{
            self.noRoutes();
          }
          hideLoader(self.getContainer());
        },
        
        error: function(data){
            console.error("ERROR",data)
        }
    })        
  },

  noRoutes: function(){
    var notFoundEl = this.components.not_found_panel;
    notFoundEl.innerHTML="Для выбранного населенного пункта, маршрутов не найдено";
    $(notFoundEl).removeClass("hidden");
  },

  notFound: function(){
    var notFoundEl = this.components.not_found_panel;
    notFoundEl.innerHTML="По заданным фильтрам маршрутов не найдено";
    $(notFoundEl).removeClass("hidden");
  },

  reload: function() {
    this.reset();
    this.loadData();
  },

  reset: function () {    
    var container = this.getContainer(),
        components = this.components;
    $(components.not_found_panel).addClass("hidden");    
  },
})


/*
 ****************   [CALLBACKS]   *********************
*/
var onDirectionChange = function(e){
  //console.log("[CALLBACK] ON_DIRECTION_CHANGE", this, e)  
  var radio_item = this.parentElement.parentElement;
      index = parseInt(radio_item.getAttribute('data-direction-index')),
      direction = radio_item.directions,
      route_name_container = radio_item.getElementsByClassName("route-direction")[0];

  index = index >= direction.length-1? 0: index+1;

  radio_item.setAttribute('data-direction-index',index);
  var current_direction = direction[index]?direction[index]:direction;
  radio_item.setDirectionName(current_direction, route_name_container);
}

function onRoutesLoad(data, directionString, route_name, e){
  //console.log("[CALLBACK] ON_ROUTES_LOAD",e, data, directionString, route_name)
  var route_item_container = e.currentTarget;
  var current_direction;      
  route_item_container.directions = data.directions;  
  route_item_container.setAttribute("data-loaded",true);              
  if(Array.isArray(data.directions)){
    current_direction = directionString?data.directions.find(function(dir){return dir.directionString == directionString }) : data.directions[0];
  }else{
    current_direction = data.directions;          
  }   
  var stops =  current_direction.stops;
  //TODO
  current_direction.cost = data.cost;
  route_item_container.route_cost = data.cost;
  //console.log("direction",direction);         
  drawRoutes(current_direction, route_name);
  showStops(stops);
  showDetailInfo(current_direction, route_item_container);
  hideLoader($(".route_stops"));      
  return current_direction;
}

var onRouteItemClick = function(e){
  //console.log("[CALLBACL] ON_ROUTE_ITEM_CLICK",e);
  var route_item_container = e.currentTarget,
      directionString = route_item_container.getAttribute("data-direction-string"),
      route_name = route_item_container.childNodes[0].innerHTML;
  //console.log("[PARAMS]",route_item_container, directionString, route_name, SCOPE +"api/routes/");
  if(!route_item_container.getAttribute("data-loaded")){        
    showLoader($(".route_stops"));
    $.get( SCOPE +"/api/routes/"+route_name).success(function(data){
      if(data.result == "ERROR"){
        console.error("[ERROR]", data);
        growl.error("Ошибка при запросе данных");
      }else{
        onRoutesLoad(data, directionString, route_name, e);       
      }       
    });                  
  }else{            
    var index = route_item_container.getAttribute('data-direction-index'),
        direction = route_item_container.directions,
        current_direction = index?direction[index]:direction;
    //console.log("click",route_item_container, direction, index)
    current_direction.cost = route_item_container.route_cost;       
    drawRoutes(current_direction, route_name)
    showDetailInfo(current_direction,route_item_container);
    showStops(current_direction.stops);                  
  }
}

var onChangeFavorite = function(e){
  e.stopPropagation();
  var el = e.currentTarget,      
      name = el.parentElement.parentElement.routeName,
      favorite = el.className.indexOf("fa-star-o")>-1;

  //console.log("[CHANGE FAVORITE ITEM]",e, el, name, favorite)
  $.ajax({
    url: SCOPE+"/transport/routes/"+name,
    type: "PUT",
    dataType: "json",
    data: {favorite: favorite},
    success: function(e){
      //console.log("[SUCCESS]",e)
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